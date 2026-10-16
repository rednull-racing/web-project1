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
import { CreateItemDraft, updateItemDraftImage } from "../command.js";
const transaction = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
beforeEach(() => {
    vi.resetAllMocks();
});
describe("P1: DB serviceの契約（DB非接続）", () => {
    it("AF-OWN01 SV03 T01: 作成dataとtを渡しモデル参照を返す", async () => {
        // Modelはモック。serviceが加工しない契約の確認に限る最小DTO。
        const data = { seller_id: 7, name: "作成" } as Parameters<typeof CreateItemDraft>[0]["data"];
        const row = { id: 111 };
        mocks.draft.create.mockResolvedValue(row);
        expect(await CreateItemDraft({ data, transaction })).toBe(row);
        expect(mocks.draft.create).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(mocks.draft.create.mock.calls[0][0]).toBe(data);
    });
    it.each([{ urls: [] }, { urls: ["a", "b"] }])("SV04 T01: 画像$urlsを変更済みにしてtで保存", async ({ urls }) => {
        const row = { setDataValue: vi.fn(), changed: vi.fn(), save: vi.fn().mockResolvedValue(undefined) };
        await updateItemDraftImage({
            itemDraft: row as unknown as Parameters<typeof updateItemDraftImage>[0]["itemDraft"],
            urls,
            transaction,
        });
        expect(row.setDataValue).toHaveBeenCalledExactlyOnceWith("image_url", urls);
        expect(row.setDataValue.mock.calls[0][1]).toBe(urls);
        expect(row.changed).toHaveBeenCalledExactlyOnceWith("image_url", true);
        expect(row.save).toHaveBeenCalledExactlyOnceWith({ transaction });
        const order = [row.setDataValue, row.changed, row.save].map((fn) => fn.mock.invocationCallOrder[0]);
        expect(order).toEqual([...order].sort((a, b) => a - b));
    });
    it.each(["create", "save"])("SV05: %sの元例外を返す", async (stage) => {
        const error = new Error(stage);
        if (stage === "create") {
            mocks.draft.create.mockRejectedValue(error);
            await expect(
                CreateItemDraft({ data: {} as Parameters<typeof CreateItemDraft>[0]["data"], transaction }),
            ).rejects.toBe(error);
        } else {
            const row = { setDataValue: vi.fn(), changed: vi.fn(), save: vi.fn().mockRejectedValue(error) };
            await expect(
                updateItemDraftImage({
                    itemDraft: row as unknown as Parameters<typeof updateItemDraftImage>[0]["itemDraft"],
                    urls: ["a"],
                    transaction,
                }),
            ).rejects.toBe(error);
        }
    });
    it("SV05: save完了までserviceは未完了", async () => {
        const gate = deferred<void>();
        let done = false;
        const row = { setDataValue: vi.fn(), changed: vi.fn(), save: vi.fn(() => gate.promise) };
        const pending = updateItemDraftImage({
            itemDraft: row as unknown as Parameters<typeof updateItemDraftImage>[0]["itemDraft"],
            urls: ["a"],
            transaction,
        }).then(() => {
            done = true;
        });
        try {
            expect(row.save).toHaveBeenCalledOnce();
            await Promise.resolve();
            expect(done).toBe(false);
        } finally {
            gate.resolve();
            await pending;
        }
    });
});
