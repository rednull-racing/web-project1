import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeItem } from "./fixtures.js";
const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../../src/models/index.js", () => ({ ItemEditing: { findOne: mocks.findOne }, Item: {} }));
import { getMyItemEditing } from "../../../../src/services/itemEditing/query.js";
import { updateConfirm, updateItemEditingImage } from "../../../../src/services/itemEditing/command.js";

beforeEach(() => {
    vi.resetAllMocks();
});
describe("P1: DBへ接続しないservice契約", () => {
    it.each([7, 8])("D01: ユーザー%sと商品IDの両方をwhereへ渡す", async (userId) => {
        const item = userId === 7 ? makeItem() : null;
        mocks.findOne.mockResolvedValue(item);
        expect(await getMyItemEditing({ itemEditingId: 11, userId })).toBe(item);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({ where: { id: 11, seller_id: userId } });
    });
    it("D02: updateへデータと同じtransactionオブジェクトを渡す", async () => {
        const update = vi.fn().mockResolvedValue(undefined);
        const item = { ...makeItem(), update } as unknown as Parameters<typeof updateConfirm>[0]["itemEditing"];
        const transaction = { id: "transaction" } as unknown as Transaction;
        const data: Parameters<typeof updateConfirm>[0]["data"] = {
            name: "商品",
            detail: "説明",
            price: 500,
            first_image_url: "image",
            category_id: 21,
            gender_type: "unisex",
            age_type: "both",
            brand_id: 61,
            brand_aliases_id: null,
            item_condition_id: 31,
            attributes: {},
            title: "動画",
            summary: "説明",
            thumbnail_url: "thumbnail",
            original_url: "video",
            before_price: 500,
            shipping_day_id: 41,
            shipping_service_id: 51,
            shipping_place_id: 13,
            shipping_service_free_text: null,
        };
        await updateConfirm({ itemEditing: item, data, transaction });
        expect(update).toHaveBeenCalledExactlyOnceWith(data, { transaction });
        expect(update.mock.calls[0][0]).toBe(data);
        expect(update.mock.calls[0][1].transaction).toBe(transaction);
    });
    it("D03: 配列設定・変更フラグ・saveを順に呼び同じtransactionを渡す", async () => {
        const setDataValue = vi.fn(),
            changed = vi.fn(),
            save = vi.fn().mockResolvedValue(undefined);
        const item = { ...makeItem(), setDataValue, changed, save } as unknown as Parameters<
            typeof updateItemEditingImage
        >[0]["itemEditing"];
        const transaction = { id: "transaction" } as unknown as Transaction;
        const urls = ["image-b", "image-a"];
        await updateItemEditingImage({ itemEditing: item, urls, transaction });
        expect(setDataValue).toHaveBeenCalledExactlyOnceWith("image_url", urls);
        expect(changed).toHaveBeenCalledExactlyOnceWith("image_url", true);
        expect(save).toHaveBeenCalledExactlyOnceWith({ transaction });
        expect(setDataValue.mock.invocationCallOrder[0]).toBeLessThan(changed.mock.invocationCallOrder[0]);
        expect(changed.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0]);
    });
});
