import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, makeConfirmRow } from "../../../usecases/itemEditing/test/getItemConfirmPage.fixtures.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({
    ItemEditing: { findOne: mocks.findOne }, Categories: { name: "CategoryModel" }, Brands: { name: "BrandModel" },
    ItemConditionOption: { name: "ConditionModel" }, ShippingDayOption: { name: "DayModel" },
    ShippingServiceOption: { name: "ServiceModel" }, TodouhukenOption: { name: "PlaceModel" },
}));
import { Categories, Brands, ItemConditionOption, ShippingDayOption, ShippingServiceOption, TodouhukenOption } from "../../../models/index.js";
import { getMyItemConfirmPage } from "../query.js";

beforeEach(() => vi.resetAllMocks());
describe("P0/P1 所有者限定・関連付き参照service", () => {
    it("S01: 必要列と任意関連だけを所有者whereで取得しtransaction/lockを指定しない", async () => {
        const row = makeConfirmRow();
        mocks.findOne.mockResolvedValue(row);
        expect(await getMyItemConfirmPage({ userId: 7, itemEditingId: 123 })).toBe(row);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            where: { id: 123, seller_id: 7 },
            attributes: ["id", "status", "item_id", "seller_id", "name", "detail", "price", "image_url", "first_image_url", "gender_type", "age_type", "recommend", "attributes", "thumbnail_url", "title", "summary", "duration", "original_url", "converted_url", "before_price", "discount_rate", "discount_amount", "sale_flag", "shipping_service_free_text", "updatedAt"],
            include: [
                { model: Categories, as: "Category", attributes: ["id", "name"], required: false, include: [
                    { model: Categories, attributes: ["id", "name"], as: "children", required: false },
                    { model: Categories, attributes: ["id", "name"], as: "parent", required: false },
                ] },
                { model: Brands, as: "Brand", attributes: ["id", "name"], required: false },
                { model: ItemConditionOption, attributes: ["id", "name"], required: false },
                { model: ShippingDayOption, attributes: ["id", "name"], required: false },
                { model: ShippingServiceOption, attributes: ["id", "name"], required: false },
                { model: TodouhukenOption, attributes: ["id", "name"], required: false },
            ],
        });
    });
    it("S02: nullを業務エラーへ変換せず返す", async () => {
        mocks.findOne.mockResolvedValue(null);
        expect(await getMyItemConfirmPage({ userId: 8, itemEditingId: 123 })).toBeNull();
    });
    it("S03: DB例外を同じ参照で伝播し再実行しない", async () => {
        const error = new Error("query failure");
        mocks.findOne.mockRejectedValue(error);
        await expect(getMyItemConfirmPage({ userId: 7, itemEditingId: 123 })).rejects.toBe(error);
        expect(mocks.findOne).toHaveBeenCalledOnce();
    });
    it("S04: findOne保留中は取得結果を確定しない", async () => {
        const gate = deferred<ReturnType<typeof makeConfirmRow>>(), row = makeConfirmRow();
        mocks.findOne.mockReturnValue(gate.promise);
        let done = false;
        const pending = getMyItemConfirmPage({ userId: 7, itemEditingId: 123 }).then(value => { done = true; return value; });
        const settled = Promise.allSettled([pending]);
        try { await Promise.resolve(); expect(done).toBe(false); }
        finally { gate.resolve(row); await settled; }
        expect(await pending).toBe(row);
    });
});
