import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../test/fixtures/itemDraft/createItemDraft/fixtures.js";
const mocks = vi.hoisted(() => ({
    editing: { findOne: vi.fn() },
    draft: { create: vi.fn() },
    brand: { findByPk: vi.fn(), findOne: vi.fn() },
    alias: { findOne: vi.fn(), create: vi.fn() },
    category: { findByPk: vi.fn() },
    condition: { findByPk: vi.fn() },
    day: { findByPk: vi.fn() },
    service: { findByPk: vi.fn() },
    place: { findByPk: vi.fn() },
    query: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ default: { query: mocks.query } }));
vi.mock("../../../models/index.js", () => ({
    ItemEditing: mocks.editing,
    ItemDraft: mocks.draft,
    Brands: mocks.brand,
    BrandAliases: mocks.alias,
    Categories: mocks.category,
    ItemConditionOption: mocks.condition,
    ShippingDayOption: mocks.day,
    ShippingServiceOption: mocks.service,
    TodouhukenOption: mocks.place,
}));
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => {
    vi.resetAllMocks();
});
import { getAliasOne, createAliases } from "../brandAliases.js";
describe("P1: DB serviceの契約（DB非接続）", () => {
    const lookups = [
        [
            "別名",
            () => getAliasOne({ normalized: "alias" }),
            mocks.alias.findOne,
            { where: { name_normalized: "alias" }, include: [{ model: mocks.brand, as: "brand" }] },
        ],
    ] as const;
    describe.each(lookups)("SV01 SV06: %s", (_name, run, mock, args) => {
        it.each([null, { id: 1 }])("結果%jと引数を伝達", async (row) => {
            mock.mockResolvedValue(row);
            expect(await run()).toBe(row);
            expect(mock).toHaveBeenCalledExactlyOnceWith(args);
        });
        it("例外を同じ参照で伝播", async () => {
            const error = new Error("lookup");
            mock.mockRejectedValue(error);
            await expect(run()).rejects.toBe(error);
        });
    });
});
describe("P1: 別名のtransactionロックと再検索", () => {
    const args = { inputName: " Ｂrand ", normalized: "brand", transaction };
    it("SV07: ロック→再検索→未登録なら作成、全操作に同じt", async () => {
        mocks.alias.findOne.mockResolvedValue(null);
        const row = { id: 71 };
        mocks.alias.create.mockResolvedValue(row);
        expect(await createAliases(args)).toBe(row);
        expect(mocks.query).toHaveBeenCalledExactlyOnceWith(
            "SELECT pg_advisory_xact_lock(hashtext('brand_aliases'), hashtext($normalized))",
            { bind: { normalized: "brand" }, transaction },
        );
        expect(mocks.alias.findOne).toHaveBeenCalledExactlyOnceWith({
            where: { name_normalized: "brand" },
            include: [{ model: mocks.brand, as: "brand" }],
            transaction,
        });
        expect(mocks.alias.create).toHaveBeenCalledExactlyOnceWith(
            { brand_id: null, name: " Ｂrand ", name_normalized: "brand" },
            { transaction },
        );
        const order = [mocks.query, mocks.alias.findOne, mocks.alias.create].map(
            (fn) => fn.mock.invocationCallOrder[0],
        );
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });
    it("SV08: ロック完了を待ち既存aliasを返しcreateしない", async () => {
        const gate = deferred<void>(),
            row = { id: 72 };
        mocks.query.mockReturnValue(gate.promise);
        mocks.alias.findOne.mockResolvedValue(row);
        const pending = createAliases(args);
        try {
            expect(mocks.alias.findOne).not.toHaveBeenCalled();
            expect(mocks.alias.create).not.toHaveBeenCalled();
        } finally {
            gate.resolve();
            await pending;
        }
        expect(await pending).toBe(row);
        expect(mocks.alias.create).not.toHaveBeenCalled();
    });
    it.each(["lock", "find", "create"])("SV09: %s失敗で後続停止", async (stage) => {
        const calls = [mocks.query, mocks.alias.findOne, mocks.alias.create],
            index = ["lock", "find", "create"].indexOf(stage);
        const error = new Error(stage);
        mocks.alias.findOne.mockResolvedValue(null);
        calls[index].mockRejectedValue(error);
        await expect(createAliases(args)).rejects.toBe(error);
        for (const later of calls.slice(index + 1)) expect(later).not.toHaveBeenCalled();
    });
    it("SV10: tなしはロック・再検索なしでcreate", async () => {
        const row = { id: 73 };
        mocks.alias.create.mockResolvedValue(row);
        expect(await createAliases({ inputName: "name", normalized: "name" })).toBe(row);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.alias.findOne).not.toHaveBeenCalled();
        expect(mocks.alias.create).toHaveBeenCalledExactlyOnceWith(
            { name: "name", name_normalized: "name", brand_id: null },
            { transaction: undefined },
        );
    });
});
