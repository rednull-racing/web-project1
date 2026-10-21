import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
import { getMyItemEditing } from "../query.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => {
    vi.resetAllMocks();
});
describe("P1: DB serviceの契約（DB非接続）", () => {
    it.each([undefined, transaction])("AF-AUTH01 SV01 SV02: t=%sで所有者条件と必要時だけロック", async (t) => {
        const row = { id: 11 };
        mocks.editing.findOne.mockResolvedValue(row);
        expect(await getMyItemEditing({ itemEditingId: 11, userId: 7, transaction: t })).toBe(row);
        expect(mocks.editing.findOne).toHaveBeenCalledExactlyOnceWith({
            where: { id: 11, seller_id: 7 },
            ...(t ? { transaction: t, lock: "UPDATE" } : {}),
        });
    });
    const lookups = [
        [
            "所有権",
            () => getMyItemEditing({ itemEditingId: 11, userId: 7 }),
            mocks.editing.findOne,
            { where: { id: 11, seller_id: 7 } },
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
