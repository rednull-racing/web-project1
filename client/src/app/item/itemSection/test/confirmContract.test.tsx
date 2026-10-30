import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ItemHeader } from "../itemHeader";
import { DeliverySection } from "../deliverySection";
import { Slideshow } from "../slideshow";

for (const genderType of ["men", "women", "unisex"] as const) {
    it.each(["adult", "kids", "both"] as const)("U-S01 confirm " + genderType + "/%sのタグとrecommend非表示", ageType => {
        const { container } = render(<ItemHeader page="confirm" data={{ itemName: "確認用シャツ", price: 12000, genderType, ageType, recommend: true, soldout: false, saleFlag: false, beforePrice: 15000, discountRate: 20, discountAmount: 3000 }} />);
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("確認用シャツ");
        expect(screen.getByText("￥12,000")).toBeVisible();
        expect(screen.getByText({ men: "メンズ", women: "レディース", unisex: "ユニセックス" }[genderType])).toBeVisible();
        expect(Boolean(screen.queryByText("キッズ"))).toBe(ageType === "kids");
        expect(screen.queryByText("￥15,000")).not.toBeInTheDocument();
        expect(container.querySelector('[data-icon="fire"]')).toBeNull();
    });
}
it.each([false,true])("U-S01 confirm売切=%sとセール表示", soldout => {
    render(<ItemHeader page="confirm" data={{ itemName: "確認用シャツ", price: 12000, genderType: "men", ageType: "adult", recommend: true, soldout, saleFlag: true, beforePrice: 15000, discountRate: 20, discountAmount: 3000 }} />);
    if (soldout) { expect(screen.getByText("SOLD OUT")).toBeVisible(); expect(screen.queryByText("￥12,000")).not.toBeInTheDocument(); expect(screen.queryByText("￥15,000")).not.toBeInTheDocument(); }
    else { for (const text of ["￥12,000","￥15,000","20% OFF","3,000円引き"]) expect(screen.getByText(text)).toBeVisible(); }
});
it.each([
    [1,0,null],[1,1,null],[1,2,null], [2,0,"SOLD OUT"],[2,1,"残りわずか"],[2,2,"在庫あり"],
    [4,0,"SOLD OUT"],[4,1,"残りわずか"],[4,2,"在庫あり"],
    [5,0,"SOLD OUT"],[5,1,"残りわずか"],[5,2,"在庫あり"],
    [10,1,"残りわずか"],[10,2,"残りわずか"],[10,3,"在庫あり"],
] as const)("U-S02 initial=%s/current=%sで%s", (initial,current,expected) => {
    render(<DeliverySection data={{ itemAttributes: { inventory: { initial, current, low_stock_ratio: 0.2 } }, condition: "新品", shippingService: "配送", shippingPlace: "東京", shippingDay: "翌日" }} />);
    if (expected) expect(screen.getByText(expected)).toBeVisible(); else expect(screen.queryByText("在庫")).not.toBeInTheDocument();
});
it.each([undefined, [], [{ name: "綿", ratio: 99 }], [{ name: "綿", ratio: 100 }], [{ name: "綿", ratio: 101 }]])("U-S03 materials=%jの素材行", materials => {
    render(<DeliverySection data={{ itemAttributes: { materials }, condition: "新品", shippingService: "配送", shippingPlace: "東京", shippingDay: "翌日" }} />);
    expect(Boolean(screen.queryByText("素材"))).toBe(materials?.[0]?.ratio === 100);
});
it("U-S07 空画像リストは拡大トリガーを作らない", () => {
    render(<Slideshow images={[]} />);
    expect(screen.queryByRole("button", { name: /画像.*を拡大/ })).not.toBeInTheDocument();
});
