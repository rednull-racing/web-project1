import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred, makeFormRow } from "../../../usecases/itemEditing/test/getItemEditingForm.fixtures.js";

const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({
    ItemEditing: { findOne: mocks.findOne },
    Categories: { name: "CategoryModel" },
    Brands: { name: "BrandModel" },
    ItemConditionOption: { name: "ConditionModel" },
    ShippingDayOption: { name: "DayModel" },
    ShippingServiceOption: { name: "ServiceModel" },
    TodouhukenOption: { name: "PlaceModel" },
}));
import {
    Categories,
    Brands,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../../../models/index.js";
import { getMyItemEditingForm } from "../query.js";

beforeEach(() => vi.resetAllMocks());
describe("P0/P1 所有者限定・関連付き参照service", () => {
    it("S01: 必要列と任意関連だけを所有者whereで取得しtransaction/lockを指定しない", async () => {
        const row = makeFormRow();
        mocks.findOne.mockResolvedValue(row);
        expect(await getMyItemEditingForm({ userId: 7, itemEditingId: 123 })).toBe(row);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            where: { id: 123, seller_id: 7 },
            attributes: [
                "id",
                "status",
                "seller_id",
                "name",
                "detail",
                "price",
                "image_url",
                "first_image_url",
                "gender_type",
                "age_type",
                "attributes",
                "thumbnail_url",
                "title",
                "summary",
                "duration",
                "original_url",
                "converted_url",
                "before_price",
                "shipping_service_free_text",
            ],
            include: [
                {
                    model: Categories,
                    as: "Category",
                    attributes: ["id", "name", "allowed_gender", "allowed_age", "parent_id"],
                    required: false,
                    include: [
                        { model: Categories, attributes: ["id", "name", "allowed_gender", "allowed_age", "parent_id"], as: "children", required: false },
                        { model: Categories, attributes: ["id", "name", "allowed_gender", "allowed_age", "parent_id"], as: "parent", required: false },
                    ],
                },
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
        expect(await getMyItemEditingForm({ userId: 8, itemEditingId: 123 })).toBeNull();
    });
    it("S03: DB例外を同じ参照で伝播し再実行しない", async () => {
        const error = new Error("query failure");
        mocks.findOne.mockRejectedValue(error);
        await expect(getMyItemEditingForm({ userId: 7, itemEditingId: 123 })).rejects.toBe(error);
        expect(mocks.findOne).toHaveBeenCalledOnce();
    });
    it("S04: findOne保留中は取得結果を確定しない", async () => {
        const gate = deferred<ReturnType<typeof makeFormRow>>(),
            row = makeFormRow();
        mocks.findOne.mockReturnValue(gate.promise);
        let done = false;
        const pending = getMyItemEditingForm({ userId: 7, itemEditingId: 123 }).then((value) => {
            done = true;
            return value;
        });
        const settled = Promise.allSettled([pending]);
        try {
            await Promise.resolve();
            expect(done).toBe(false);
        } finally {
            gate.resolve(row);
            await settled;
        }
        expect(await pending).toBe(row);
    });
});
