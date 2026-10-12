import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "./fixtures.js";
const mocks = vi.hoisted(() => ({
    editing: { findOne: vi.fn() }, draft: { create: vi.fn() },
    brand: { findByPk: vi.fn(), findOne: vi.fn() }, alias: { findOne: vi.fn(), create: vi.fn() },
    category: { findByPk: vi.fn() }, condition: { findByPk: vi.fn() },
    day: { findByPk: vi.fn() }, service: { findByPk: vi.fn() }, place: { findByPk: vi.fn() }, query: vi.fn(),
}));
vi.mock("../../../../src/db.js", () => ({ default: { query: mocks.query } }));
vi.mock("../../../../src/models/index.js", () => ({
    ItemEditing: mocks.editing, ItemDraft: mocks.draft, Brands: mocks.brand, BrandAliases: mocks.alias,
    Categories: mocks.category, ItemConditionOption: mocks.condition, ShippingDayOption: mocks.day,
    ShippingServiceOption: mocks.service, TodouhukenOption: mocks.place,
}));
import { getMyItemEditing } from "../../../../src/services/itemEditing/query.js";
import { CreateItemDraft, updateItemDraftImage } from "../../../../src/services/itemDraft/command.js";
import { getBrand, getBrandOne } from "../../../../src/services/brands.js";
import { getAliasOne, createAliases } from "../../../../src/services/brandAliases.js";
import { getCategories } from "../../../../src/services/categories.js";
import { getItemCondition } from "../../../../src/services/itemConditionOption.js";
import { getShippingDay } from "../../../../src/services/shippingDayOption.js";
import { getShippingService } from "../../../../src/services/shippingServiceOption.js";
import { getTodouhuken } from "../../../../src/services/todouhuken.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => { vi.resetAllMocks(); });
describe("P1: DB serviceの契約（DB非接続）", () => {
    it.each([undefined, transaction])("SV01 SV02: t=%sで所有者条件と必要時だけロック", async (t) => {
        const row = { id: 11 }; mocks.editing.findOne.mockResolvedValue(row);
        expect(await getMyItemEditing({ itemEditingId: 11, userId: 7, transaction: t })).toBe(row);
        expect(mocks.editing.findOne).toHaveBeenCalledExactlyOnceWith({ where: { id: 11, seller_id: 7 }, ...(t ? { transaction: t, lock: "UPDATE" } : {}) });
    });
    it("SV03 T01: 作成dataとtを渡しモデル参照を返す", async () => {
        // Modelはモック。serviceが加工しない契約の確認に限る最小DTO。
        const data = { name: "作成" } as Parameters<typeof CreateItemDraft>[0]["data"];
        const row = { id: 111 }; mocks.draft.create.mockResolvedValue(row);
        expect(await CreateItemDraft({ data, transaction })).toBe(row);
        expect(mocks.draft.create).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(mocks.draft.create.mock.calls[0][0]).toBe(data);
    });
    it.each([{ urls: [] }, { urls: ["a", "b"] }])("SV04 T01: 画像$urlsを変更済みにしてtで保存", async ({ urls }) => {
        const row = { setDataValue: vi.fn(), changed: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        await updateItemDraftImage({ itemDraft: row as unknown as Parameters<typeof updateItemDraftImage>[0]["itemDraft"], urls, transaction });
        expect(row.setDataValue).toHaveBeenCalledExactlyOnceWith("image_url", urls);
        expect(row.setDataValue.mock.calls[0][1]).toBe(urls);
        expect(row.changed).toHaveBeenCalledExactlyOnceWith("image_url", true);
        expect(row.save).toHaveBeenCalledExactlyOnceWith({ transaction });
        const order = [row.setDataValue, row.changed, row.save].map(fn => fn.mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a,b) => a-b));
    });
    it.each(["create", "save"])("SV05: %sの元例外を返す", async (stage) => {
        const error = new Error(stage);
        if (stage === "create") {
            mocks.draft.create.mockRejectedValue(error);
            await expect(CreateItemDraft({ data: {} as Parameters<typeof CreateItemDraft>[0]["data"], transaction })).rejects.toBe(error);
        } else {
            const row = { setDataValue: vi.fn(), changed: vi.fn(), save: vi.fn().mockRejectedValue(error) };
            await expect(updateItemDraftImage({ itemDraft: row as unknown as Parameters<typeof updateItemDraftImage>[0]["itemDraft"], urls: ["a"], transaction })).rejects.toBe(error);
        }
    });
    it("SV05: save完了までserviceは未完了", async () => {
        const gate = deferred<void>(); let done = false;
        const row = { setDataValue: vi.fn(), changed: vi.fn(), save: vi.fn(() => gate.promise) };
        const pending = updateItemDraftImage({ itemDraft: row as unknown as Parameters<typeof updateItemDraftImage>[0]["itemDraft"], urls: ["a"], transaction }).then(() => { done = true; });
        try { expect(row.save).toHaveBeenCalledOnce(); await Promise.resolve(); expect(done).toBe(false); }
        finally { gate.resolve(); await pending; }
    });
    const lookups = [
        ["所有権", () => getMyItemEditing({ itemEditingId: 11, userId: 7 }), mocks.editing.findOne, { where: { id: 11, seller_id: 7 } }],
        ["カテゴリ", () => getCategories({ categoryId: 21 }), mocks.category.findByPk, 21],
        ["状態", () => getItemCondition({ conditionId: 31 }), mocks.condition.findByPk, 31],
        ["配送日", () => getShippingDay({ dayId: 41 }), mocks.day.findByPk, 41],
        ["配送サービス", () => getShippingService({ serviceId: 51 }), mocks.service.findByPk, 51],
        ["発送元", () => getTodouhuken({ todouhukenId: 13 }), mocks.place.findByPk, 13],
        ["ブランドID", () => getBrand({ brandId: 61 }), mocks.brand.findByPk, 61],
        ["ブランド名", () => getBrandOne({ normalized: "brand" }), mocks.brand.findOne, { where: { name_normalized: "brand" } }],
        ["別名", () => getAliasOne({ normalized: "alias" }), mocks.alias.findOne, { where: { name_normalized: "alias" }, include: [{ model: mocks.brand, as: "brand" }] }],
    ] as const;
    describe.each(lookups)("SV01 SV06: %s", (_name, run, mock, args) => {
        it.each([null, { id: 1 }])("結果%jと引数を伝達", async (row) => {
            mock.mockResolvedValue(row); expect(await run()).toBe(row); expect(mock).toHaveBeenCalledExactlyOnceWith(args);
        });
        it("例外を同じ参照で伝播", async () => { const error = new Error("lookup"); mock.mockRejectedValue(error); await expect(run()).rejects.toBe(error); });
    });
});
describe("P1: 別名のtransactionロックと再検索", () => {
    const args = { inputName: " Ｂrand ", normalized: "brand", transaction };
    it("SV07: ロック→再検索→未登録なら作成、全操作に同じt", async () => {
        mocks.alias.findOne.mockResolvedValue(null); const row = { id: 71 }; mocks.alias.create.mockResolvedValue(row);
        expect(await createAliases(args)).toBe(row);
        expect(mocks.query).toHaveBeenCalledExactlyOnceWith("SELECT pg_advisory_xact_lock(hashtext('brand_aliases'), hashtext($normalized))", { bind: { normalized: "brand" }, transaction });
        expect(mocks.alias.findOne).toHaveBeenCalledExactlyOnceWith({ where: { name_normalized: "brand" }, include: [{ model: mocks.brand, as: "brand" }], transaction });
        expect(mocks.alias.create).toHaveBeenCalledExactlyOnceWith({ brand_id: null, name: " Ｂrand ", name_normalized: "brand" }, { transaction });
        const order = [mocks.query, mocks.alias.findOne, mocks.alias.create].map(fn => fn.mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a,b) => a-b));
    });
    it("SV08: ロック完了を待ち既存aliasを返しcreateしない", async () => {
        const gate = deferred<void>(), row = { id: 72 };
        mocks.query.mockReturnValue(gate.promise); mocks.alias.findOne.mockResolvedValue(row);
        const pending = createAliases(args);
        try { expect(mocks.alias.findOne).not.toHaveBeenCalled(); expect(mocks.alias.create).not.toHaveBeenCalled(); }
        finally { gate.resolve(); await pending; }
        expect(await pending).toBe(row); expect(mocks.alias.create).not.toHaveBeenCalled();
    });
    it.each(["lock", "find", "create"])("SV09: %s失敗で後続停止", async (stage) => {
        const calls = [mocks.query, mocks.alias.findOne, mocks.alias.create], index = ["lock", "find", "create"].indexOf(stage);
        const error = new Error(stage); mocks.alias.findOne.mockResolvedValue(null); calls[index].mockRejectedValue(error);
        await expect(createAliases(args)).rejects.toBe(error);
        for (const later of calls.slice(index + 1)) expect(later).not.toHaveBeenCalled();
    });
    it("SV10: tなしはロック・再検索なしでcreate", async () => {
        const row = { id: 73 }; mocks.alias.create.mockResolvedValue(row);
        expect(await createAliases({ inputName: "name", normalized: "name" })).toBe(row);
        expect(mocks.query).not.toHaveBeenCalled(); expect(mocks.alias.findOne).not.toHaveBeenCalled();
        expect(mocks.alias.create).toHaveBeenCalledExactlyOnceWith({ name: "name", name_normalized: "name", brand_id: null }, { transaction: undefined });
    });
});
