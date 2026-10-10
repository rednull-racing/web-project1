import "./databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForeignKeyConstraintError, QueryTypes } from "sequelize";
import { seed, run, snapshot, newMedia, observer, ItemEditing, BrandAliases } from "./databaseFixtures.js";
import type { DbFixture } from "./databaseFixtures.js";
import { deferred } from "./fixtures.js";
import * as command from "../../../../src/services/itemEditing/command.js";
import * as master from "../../../../src/usecases/shared/validateMaster.js";

let f: DbFixture;
beforeEach(async () => { f = await seed(); });

describe("P0 DB transaction・再試行", () => {
    it.each(["本体", "画像"])("E12 E13 ST07 T03 T05: %s保存失敗で商品全列と新規aliasをrollback", async (stage) => {
        const before = await snapshot(f.editing.id);
        f.body.brand = { id: null, name: `${f.prefix}rollback` };
        newMedia(f.body);
        const error = new Error("意図した保存失敗");
        const update = vi.spyOn(command, "updateConfirm");
        const images = vi.spyOn(command, "updateItemEditingImage");
        if (stage === "本体") update.mockRejectedValueOnce(error);
        else images.mockRejectedValueOnce(error);
        await expect(run(f)).rejects.toBe(error);
        expect(await snapshot(f.editing.id)).toEqual(before);
        expect(await BrandAliases.count({ where: { name_normalized: f.body.brand.name } })).toBe(0);
        if (stage === "本体") expect(images).not.toHaveBeenCalled();
        else {
            expect(update).toHaveBeenCalledOnce();
            await expect(update.mock.results[0].value).resolves.toBeUndefined();
        }
    });

    it("T04: 本体更新後は別接続から旧値、両更新commit後は新値が見える", async () => {
        const before = await snapshot(f.editing.id);
        const entered = deferred<void>();
        const release = deferred<void>();
        const real = command.updateItemEditingImage;
        const images = vi.spyOn(command, "updateItemEditingImage").mockImplementation(async (params) => {
            entered.resolve();
            await release.promise;
            return real(params);
        });
        newMedia(f.body);
        const pending = run(f);
        try {
            await Promise.race([entered.promise, pending.then(() => { throw new Error("画像更新に到達しなかった"); })]);
            expect(await snapshot(f.editing.id)).toEqual(before);
        } finally {
            release.resolve();
            await pending;
        }
        expect(images).toHaveBeenCalledOnce();
        expect(await snapshot(f.editing.id)).toMatchObject({ name: "商品名", price: 300, image_url: expect.arrayContaining([expect.stringContaining("/item-image/")]) });
    });

    it("T07 Q05: 初回画像失敗後、同じbodyの再試行でalias1行と商品をcommit", async () => {
        const before = await snapshot(f.editing.id);
        f.body.brand = { id: null, name: `${f.prefix}retry` };
        newMedia(f.body);
        const error = new Error("初回だけ失敗");
        vi.spyOn(command, "updateItemEditingImage").mockRejectedValueOnce(error);
        await expect(run(f)).rejects.toBe(error);
        expect(await snapshot(f.editing.id)).toEqual(before);
        expect(await BrandAliases.count({ where: { name_normalized: f.body.brand.name } })).toBe(0);
        await run(f);
        const aliases = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } });
        expect(aliases).toHaveLength(1);
        expect(await snapshot(f.editing.id)).toMatchObject({ name: "商品名", price: 300, brand_aliases_id: aliases[0].id,
            image_url: expect.arrayContaining([expect.stringContaining("/item-image/")]) });
    });

    it("D07: マスター検証後に別接続で削除すると外部キー違反、商品はrollback", async () => {
        const before = await snapshot(f.editing.id);
        const real = master.validateMaster;
        vi.spyOn(master, "validateMaster").mockImplementationOnce(async (params) => {
            const result = await real(params);
            await observer.query('DELETE FROM categories WHERE id = :id', { replacements: { id: f.category.id }, type: QueryTypes.DELETE });
            return result;
        });
        const images = vi.spyOn(command, "updateItemEditingImage");
        await expect(run(f)).rejects.toBeInstanceOf(ForeignKeyConstraintError);
        expect(images).not.toHaveBeenCalled();
        expect(await snapshot(f.editing.id)).toEqual(before);
    });

    it("T05: alias作成済みでも本体の実DB制約違反でaliasを含めrollback", async () => {
        f.body.brand = { id: null, name: `${f.prefix}constraint` };
        f.body.itemMeta.name = "あ".repeat(256);
        const before = await snapshot(f.editing.id);
        const aliases = vi.spyOn(BrandAliases, "create");
        await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22001" } });
        expect(aliases).toHaveBeenCalledOnce();
        await expect(aliases.mock.results[0].value).resolves.toBeInstanceOf(BrandAliases);
        expect(await BrandAliases.count({ where: { name_normalized: f.body.brand.name } })).toBe(0);
        expect(await snapshot(f.editing.id)).toEqual(before);
        expect((await ItemEditing.findByPk(f.editing.id))!.brand_aliases_id).toBeNull();
    });
});
