import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDraft, createEmptyDraft, deepFreeze } from "@/../test/fixtures/item/itemDraftPage/fixtures";
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
    it("U-V03 全入力の変換・表示順・下書きフラグ・入力非破壊", () => {
        const draft = deepFreeze(createDraft());
        const before = structuredClone(draft);
        const { container } = render(<ItemSection itemDraft={draft} soldout={true} />);
        expect(container.textContent).toBe("slideheadervariantsdetailcategorydelivery");
        expect(mocks.slide).toHaveBeenCalledWith({ images: draft.image_url });
        expect(mocks.header).toHaveBeenCalledWith({
            page: "draft",
            data: {
                itemName: draft.name,
                price: 800,
                genderType: "men",
                ageType: "adult",
                recommend: true,
                soldout: true,
                saleFlag: true,
                beforePrice: 1200,
                discountRate: 25,
                discountAmount: 400,
            },
        });
        expect(mocks.variants).toHaveBeenCalledWith({ itemAttributes: draft.attributes });
        expect(mocks.detail).toHaveBeenCalledWith({
            normalPage: false,
            data: { itemId: null, detail: draft.detail, soldout: true },
        });
        expect(mocks.category).toHaveBeenCalledWith({ categoryName: "シャツ" });
        expect(mocks.delivery).toHaveBeenCalledWith({
            data: {
                itemAttributes: draft.attributes,
                condition: "新品",
                shippingService: "指定配送",
                shippingPlace: "東京都",
                shippingDay: "1〜2日",
            },
        });
        expect(draft).toEqual(before);
    });
    it("U-V03 nullable情報を補完し空バリエーションは描画しない", () => {
        render(<ItemSection itemDraft={deepFreeze(createEmptyDraft())} soldout={false} />);
        expect(mocks.slide).toHaveBeenCalledWith({ images: ["/no-image(1x1).png"] });
        expect(mocks.header).toHaveBeenCalledWith({
            page: "draft",
            data: {
                itemName: "商品名未入力",
                price: "-",
                genderType: "men",
                ageType: "adult",
                recommend: false,
                soldout: false,
                saleFlag: false,
                beforePrice: 0,
                discountRate: 0,
                discountAmount: 0,
            },
        });
        expect(mocks.variants).not.toHaveBeenCalled();
        expect(mocks.detail).toHaveBeenCalledWith({
            normalPage: false,
            data: { itemId: null, detail: "", soldout: false },
        });
        expect(mocks.category).toHaveBeenCalledWith({ categoryName: "" });
        expect(mocks.delivery).toHaveBeenCalledWith({
            data: { itemAttributes: {}, condition: "-", shippingService: "-", shippingPlace: "-", shippingDay: "-" },
        });
    });
    it.each([null, [], [""], ["", "/image.png"]])("U-V03 image_url=%j の空文字を除外し空なら代替1枚", (image_url) => {
        render(<ItemSection itemDraft={createDraft({ image_url })} soldout={false} />);
        expect(mocks.slide).toHaveBeenCalledWith({
            images: image_url?.includes("/image.png") ? ["/image.png"] : ["/no-image(1x1).png"],
        });
    });
    it.each([0, 1, null])("U-V03 price=%s を0と未入力で区別する", (price) => {
        render(<ItemSection itemDraft={createDraft({ price })} soldout={false} />);
        expect(mocks.header.mock.calls[0][0].data.price).toBe(price ?? "-");
    });
    it.each([undefined, [], [{}], [{ image_url: "" }, { image_url: "/blue.png" }]])(
        "U-V03 variants=%j の件数・画像補完と非破壊",
        (colorVariants) => {
            const draft = deepFreeze(createDraft({ attributes: { colorVariants } }));
            const before = structuredClone(draft);
            render(<ItemSection itemDraft={draft} soldout={false} />);
            if (colorVariants?.length) {
                expect(mocks.variants).toHaveBeenCalledOnce();
                const variants = mocks.variants.mock.calls[0][0].itemAttributes.colorVariants;
                expect(variants.map((v: { image_url: string }) => v.image_url)).toEqual(
                    colorVariants.map((v) => v.image_url || "/no-image(1x1).png"),
                );
            } else expect(mocks.variants).not.toHaveBeenCalled();
            expect(draft).toEqual(before);
        },
    );
    it.each([
        ["自由記述", "選択肢", "自由記述"],
        ["", "選択肢", "選択肢"],
        [null, "", "-"],
    ])("U-V03 配送は%s・%sから%s", (free, option, expected) => {
        render(
            <ItemSection
                itemDraft={createDraft({
                    shipping_service_free_text: free,
                    ShippingServiceOption: { id: "2", name: option! },
                })}
                soldout={false}
            />,
        );
        expect(mocks.delivery.mock.calls[0][0].data.shippingService).toBe(expected);
    });
    it("U-V03 空の商品名を補完し未入力説明は空文字を保持する", () => {
        render(<ItemSection itemDraft={createDraft({ name: "", detail: "" })} soldout={false} />);
        expect(mocks.header.mock.calls[0][0].data.itemName).toBe("商品名未入力");
        expect(mocks.detail.mock.calls[0][0].data.detail).toBe("");
    });
});
