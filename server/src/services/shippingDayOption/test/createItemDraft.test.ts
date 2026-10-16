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
beforeEach(() => {
    vi.resetAllMocks();
});
import { getShippingDay } from "../shippingDayOption.js";
describe("P1: DB serviceの契約（DB非接続）", () => {
    const lookups = [
        ["配送日", () => getShippingDay({ dayId: 41 }), mocks.day.findByPk, 41],
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
