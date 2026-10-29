import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeDraft } from "../../../../test/fixtures/itemDraft/getItemDraftPage/fixtures.js";
const mocks = vi.hoisted(() => ({ findOne: vi.fn() }));
vi.mock("../../../models/index.js", () => ({
    ItemDraft: { findOne: mocks.findOne },
    Categories: {},
    Brands: {},
    ItemConditionOption: {},
    ShippingDayOption: {},
    ShippingServiceOption: {},
    TodouhukenOption: {},
}));
import {
    Categories,
    Brands,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../../../models/index.js";
import { getMyItemDraftPage } from "../query.js";
beforeEach(() => vi.resetAllMocks());
describe("P0/P1 getMyItemDraftPage", () => {
    it("S01 公開列と関連・所有者whereを完全一致で指定し同じ参照を返す", async () => {
        const row = makeDraft();
        mocks.findOne.mockResolvedValue(row);
        expect(await getMyItemDraftPage({ itemDraftId: 101, userId: 7 })).toBe(row);
        expect(mocks.findOne).toHaveBeenCalledExactlyOnceWith({
            attributes: [
                "id",
                "seller_id",
                "name",
                "detail",
                "price",
                "image_url",
                "first_image_url",
                "gender_type",
                "age_type",
                "recommend",
                "attributes",
                "thumbnail_url",
                "title",
                "summary",
                "duration",
                "original_url",
                "converted_url",
                "before_price",
                "discount_rate",
                "discount_amount",
                "sale_flag",
                "shipping_service_free_text",
                "updatedAt",
            ],
            where: { id: 101, seller_id: 7 },
            include: [
                {
                    model: Categories,
                    as: "Category",
                    required: false,
                    attributes: ["id", "name"],
                    include: [
                        {
                            model: Categories,
                            as: "children",
                            required: false,
                            attributes: ["id", "name"],
                        },
                        {
                            model: Categories,
                            as: "parent",
                            required: false,
                            attributes: ["id", "name"],
                        },
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
    it("S02 nullを返す", async () => {
        mocks.findOne.mockResolvedValue(null);
        expect(await getMyItemDraftPage({ itemDraftId: 101, userId: 7 })).toBeNull();
        expect(mocks.findOne).toHaveBeenCalledOnce();
    });
    it("S02 元例外を伝播する", async () => {
        const error = new Error("db");
        mocks.findOne.mockRejectedValue(error);
        await expect(getMyItemDraftPage({ itemDraftId: 101, userId: 7 })).rejects.toBe(error);
        expect(mocks.findOne).toHaveBeenCalledOnce();
    });
});
