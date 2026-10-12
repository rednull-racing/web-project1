import "./databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForeignKeyConstraintError, QueryTypes } from "sequelize";
import { seed, run, draftRows, onlyDraft, editingSnapshot, aliasRows, newMedia, observer, ItemDraft, BrandAliases } from "./databaseFixtures.js";
import type { DbFixture } from "./databaseFixtures.js";
import { deferred } from "./fixtures.js";
import * as command from "../../../../src/services/itemDraft/command.js";
import * as brands from "../../../../src/services/brands.js";
import * as aliases from "../../../../src/services/brandAliases.js";
import * as master from "../../../../src/usecases/shared/validateMaster.js";
let f: DbFixture;
beforeEach(async () => { f = await seed(); });
describe("P0/P1: 実transactionの原子性・可視性", () => {
    it.each([["E10", "本体前"], ["E11", "画像前"], ["E11", "画像後"]])(
        "%s AF-OWN03 AF-NAME01 T04 T05 ST07: %sの障害で新規aliasと本体がrollback", async (_id, stage) => {
        const before = await editingSnapshot(f.editing.id); const name = `${f.prefix}rollback`; f.body.brand = { id: null, name }; newMedia(f.body);
        const error = new Error("意図した保存失敗"), real = command.updateItemDraftImage;
        const aliases = vi.spyOn(BrandAliases, "create"), create = vi.spyOn(command, "CreateItemDraft"), images = vi.spyOn(command, "updateItemDraftImage");
        if (stage === "本体前") create.mockRejectedValueOnce(error);
        else images.mockImplementationOnce(async (params) => { if (stage === "画像後") await real(params); throw error; });
        await expect(run(f)).rejects.toBe(error);
        expect(aliases).toHaveBeenCalledOnce(); await expect(aliases.mock.results[0].value).resolves.toBeInstanceOf(BrandAliases);
        expect(create.mock.calls[0][0].data.seller_id).toBe(f.owner.id);
        if (stage === "本体前") expect(images).not.toHaveBeenCalled();
        else { expect(create).toHaveBeenCalledOnce(); await expect(create.mock.results[0].value).resolves.toBeInstanceOf(ItemDraft); }
        expect(await draftRows()).toEqual([]); expect(await aliasRows(name)).toEqual([]); expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it("T04: 失敗しても作成前から存在するaliasは削除しない", async () => {
        const name = `${f.prefix}existing`; const alias = await BrandAliases.create({ name, name_normalized: name, brand_id: null });
        f.body.brand = { id: null, name }; const error = new Error("画像失敗"); vi.spyOn(command, "updateItemDraftImage").mockRejectedValueOnce(error);
        await expect(run(f)).rejects.toBe(error); expect(await draftRows()).toEqual([]); expect(await aliasRows(name)).toEqual([{ id: alias.id, brand_id: null }]);
    });
    it.each(["画像前", "画像後"])("T03 T06: %sのcommit前には別接続から見えずcommit後は全項目が見える", async (stage) => {
        const name = `${f.prefix}visible`; f.body.brand = { id: null, name }; newMedia(f.body);
        const entered = deferred<void>(), release = deferred<void>(), real = command.updateItemDraftImage;
        let localRows: unknown[] = [];
        vi.spyOn(command, "updateItemDraftImage").mockImplementationOnce(async (params) => {
            if (stage === "画像後") await real(params);
            localRows = await ItemDraft.findAll({ where: { id: params.itemDraft.id }, transaction: params.transaction });
            entered.resolve(); await release.promise;
            if (stage === "画像前") await real(params);
        });
        const pending = run(f);
        try {
            await Promise.race([entered.promise, pending.then(() => { throw new Error("待合せ未到達"); })]);
            expect(localRows).toHaveLength(1); expect(await draftRows()).toEqual([]); expect(await aliasRows(name)).toEqual([]);
        } finally { release.resolve(); await pending; }
        const aliases = await aliasRows(name); expect(aliases).toHaveLength(1);
        expect(await onlyDraft()).toMatchObject({ brand_aliases_id: aliases[0].id, name: "商品名", price: 300,
            image_url: expect.arrayContaining([expect.stringContaining("/item-image/")]) });
    });
    it("T07 Q04: 画像失敗後に再試行すると成功回だけ下書き・alias各1行", async () => {
        const name = `${f.prefix}retry`; f.body.brand = { id: null, name }; newMedia(f.body);
        const before = await editingSnapshot(f.editing.id), error = new Error("初回失敗");
        vi.spyOn(command, "updateItemDraftImage").mockRejectedValueOnce(error);
        await expect(run(f)).rejects.toBe(error); expect(await draftRows()).toEqual([]); expect(await aliasRows(name)).toEqual([]);
        await run(f); const aliases = await aliasRows(name); expect(aliases).toHaveLength(1);
        expect(await onlyDraft()).toHaveProperty("brand_aliases_id", aliases[0].id); expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it("T04 D06: schema通過後のservice障害としてDB文字数エラーを注入しaliasもrollback", async () => {
        const name = `${f.prefix}constraint`; f.body.brand = { id: null, name };
        // HTTP入力は正常のまま、本体serviceの境界でDB制約違反を注入する。
        const realCreate = command.CreateItemDraft;
        vi.spyOn(command, "CreateItemDraft").mockImplementationOnce(params => realCreate({
            ...params, data: { ...params.data, name: "あ".repeat(256) },
        }));
        const aliases = vi.spyOn(BrandAliases, "create");
        await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22001" } });
        expect(aliases).toHaveBeenCalledOnce(); await expect(aliases.mock.results[0].value).resolves.toBeInstanceOf(BrandAliases);
        expect(await aliasRows(name)).toEqual([]); expect(await draftRows()).toEqual([]);
    });
    it.each(["category", "condition", "day", "service", "place"] as const)("T09: 検証後に%sを別接続で削除するとFK失敗・aliasもrollback", async (field) => {
        const name = `${f.prefix}deleted`; f.body.brand = { id: null, name };
        const table = { category: "categories", condition: "item_condition_option", day: "shipping_day_option", service: "shipping_service_option", place: "todouhuken_option" }[field];
        const real = master.validateMaster;
        vi.spyOn(master, "validateMaster").mockImplementationOnce(async (params) => {
            const result = await real(params);
            await observer.query(`DELETE FROM ${table} WHERE id = :id`, { replacements: { id: f[field].id }, type: QueryTypes.DELETE });
            return result;
        });
        const images = vi.spyOn(command, "updateItemDraftImage");
        await expect(run(f)).rejects.toBeInstanceOf(ForeignKeyConstraintError);
        expect(images).not.toHaveBeenCalled(); expect(await aliasRows(name)).toEqual([]); expect(await draftRows()).toEqual([]);
    });
});


describe("P1: ブランドservice障害の実transaction", () => {
    it.each(["getBrand", "getAliasOne", "getBrandOne", "createAliases"] as const)(
        "E09: %s失敗は本体・画像を未実行にし新規aliasを残さない", async stage => {
            const name = `${f.prefix}failure`, error = new Error("ブランド障害");
            if (stage !== "getBrand") f.body.brand = { id: null, name };
            if (stage === "getBrand") vi.spyOn(brands, "getBrand").mockImplementationOnce(() => { throw error; });
            if (stage === "getAliasOne") vi.spyOn(aliases, "getAliasOne").mockImplementationOnce(() => { throw error; });
            if (stage === "getBrandOne") vi.spyOn(brands, "getBrandOne").mockImplementationOnce(() => { throw error; });
            if (stage === "createAliases") {
                const real = aliases.createAliases;
                vi.spyOn(aliases, "createAliases").mockImplementationOnce(async params => {
                    const alias = await real(params); expect(alias).toBeInstanceOf(BrandAliases); throw error;
                });
            }
            const create = vi.spyOn(command, "CreateItemDraft"), images = vi.spyOn(command, "updateItemDraftImage");
            await expect(run(f)).rejects.toBe(error);
            expect(create).not.toHaveBeenCalled(); expect(images).not.toHaveBeenCalled();
            expect(await draftRows()).toEqual([]); expect(await aliasRows(name)).toEqual([]);
        });
});
