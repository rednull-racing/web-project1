import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createEditing } from "./fixtures";
import { ItemSection } from "../itemSection";

const mocks = vi.hoisted(() => ({
    slide: vi.fn(),
    header: vi.fn(),
    variants: vi.fn(),
    detail: vi.fn(),
    category: vi.fn(),
    delivery: vi.fn(),
}));
vi.mock("../../itemSection/slideshow", () => ({
    Slideshow: (props: unknown) => {
        mocks.slide(props);
        return <div>slide</div>;
    },
}));
vi.mock("../../itemSection/itemHeader", () => ({
    ItemHeader: (props: unknown) => {
        mocks.header(props);
        return <div>header</div>;
    },
}));
vi.mock("../../itemSection/variantsList", () => ({
    VariantsList: (props: unknown) => {
        mocks.variants(props);
        return <div>variants</div>;
    },
}));
vi.mock("../../itemSection/detail", () => ({
    Detail: (props: unknown) => {
        mocks.detail(props);
        return <div>detail</div>;
    },
}));
vi.mock("../../itemSection/categoryText", () => ({
    CategoryText: (props: unknown) => {
        mocks.category(props);
        return <div>category</div>;
    },
}));
vi.mock("../../itemSection/deliverySection", () => ({
    DeliverySection: (props: unknown) => {
        mocks.delivery(props);
        return <div>delivery</div>;
    },
}));

describe("ItemSection 単体", () => {
    it("U-N04 全入力の変換・表示順・確認フラグ・入力非破壊", () => {
        const draft = createEditing();
        const before = structuredClone(draft);
        const { container } = render(<ItemSection itemEditing={draft} soldout={true} />);
        expect(container.textContent).toBe("slideheadervariantsdetailcategorydelivery");
        expect(mocks.slide).toHaveBeenCalledWith({ images: draft.image_url });
        expect(mocks.header).toHaveBeenCalledWith({
            page: "confirm",
            data: {
                itemName: draft.name,
                price: 12000,
                genderType: "men",
                ageType: "adult",
                recommend: true,
                soldout: true,
                saleFlag: false,
                beforePrice: 15000,
                discountRate: 20,
                discountAmount: 3000,
            },
        });
        expect(mocks.variants).toHaveBeenCalledWith({ itemAttributes: draft.attributes });
        expect(mocks.detail).toHaveBeenCalledWith({
            data: { itemId: null, detail: draft.detail, soldout: true },
        });
        expect(mocks.category).toHaveBeenCalledWith({ categoryName: "シャツ" });
        expect(mocks.delivery).toHaveBeenCalledWith({
            data: {
                itemAttributes: draft.attributes,
                condition: "新品",
                shippingService: "宅配便",
                shippingPlace: "東京都",
                shippingDay: "1〜2日",
            },
        });
        expect(draft).toEqual(before);
    });
    it("U-N04 nullable関連と割引値を補完する", () => {
        render(
            <ItemSection
                itemEditing={createEditing({
                    detail: null,
                    Category: null,
                    ItemConditionOption: null,
                    ShippingServiceOption: null,
                    ShippingDayOption: null,
                    TodouhukenOption: null,
                    discount_rate: null,
                    discount_amount: null,
                    attributes: {},
                })}
                soldout={false}
            />,
        );
        expect(mocks.header.mock.calls[0][0].data).toMatchObject({ discountRate: 0, discountAmount: 0 });
        expect(mocks.detail).toHaveBeenCalledWith({ data: { itemId: null, detail: "", soldout: false } });
        expect(mocks.category).toHaveBeenCalledWith({ categoryName: "" });
        expect(mocks.delivery).toHaveBeenCalledWith({
            data: { itemAttributes: {}, condition: "-", shippingService: "-", shippingPlace: "-", shippingDay: "-" },
        });
        expect(mocks.variants).not.toHaveBeenCalled();
    });
    it.each([undefined, [], [{}]])("U-N04 variants=%jの表示条件", (colorVariants) => {
        render(<ItemSection itemEditing={createEditing({ attributes: { colorVariants } })} soldout={false} />);
        expect(mocks.variants).toHaveBeenCalledTimes(colorVariants?.length ? 1 : 0);
    });
});
