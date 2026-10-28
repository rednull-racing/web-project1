import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ItemHeader } from "../itemHeader";
const data = { itemName: "下書きシャツ", price: 800, genderType: "men" as const, ageType: "adult" as const, recommend: true, soldout: false, saleFlag: true, beforePrice: 1200, discountRate: 25, discountAmount: 400 };

describe("商品ヘッダー", () => {
    it("U-N11 下書きの名前・価格・セールを表示しおすすめ炎を出さない", () => {
        const { container } = render(<ItemHeader data={data} page="draft" />);
        expect(screen.getByRole("heading", { level: 1, name: data.itemName })).toBeVisible();
        expect(screen.getByRole("heading", { level: 2, name: "￥800" })).toBeVisible();
        expect(screen.getByText("25% OFF")).toBeVisible();
        expect(screen.getByText("400円引き")).toBeVisible();
        expect(screen.getByText("￥1,200")).toBeVisible();
        expect(container.querySelector("#itemName")).not.toBeNull();
        expect(container.querySelector('[data-icon="fire"]')).toBeNull();
    });
    it.each([false, true])("U-N11 saleFlag=%sで正でない割引を表示しない", (saleFlag) => {
        render(<ItemHeader data={{ ...data, saleFlag, discountRate: 0, discountAmount: 0 }} page="draft" />);
        expect(screen.queryByText(/% OFF|円引き/)).not.toBeInTheDocument();
        expect(Boolean(screen.queryByText("￥1,200"))).toBe(saleFlag);
    });
    it("U-N11 売切れでは価格とセールを非表示", () => {
        render(<ItemHeader data={{ ...data, soldout: true }} page="draft" />);
        expect(screen.getByText("SOLD OUT")).toBeVisible();
        expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
        expect(screen.queryByText(/% OFF|円引き|￥1,200/)).not.toBeInTheDocument();
    });
    it.each([["men", "adult", "メンズ", false], ["women", "kids", "レディース", true], ["unisex", "both", "ユニセックス", false]] as const)("U-N11 %s/%sの属性タグ", (genderType, ageType, label, kids) => {
        render(<ItemHeader data={{ ...data, genderType, ageType }} page="draft" />);
        expect(screen.getByText(label)).toBeVisible();
        expect(Boolean(screen.queryByText("キッズ"))).toBe(kids);
    });
    it("U-S01 商品名をHTMLに変換しない", () => {
        const payload = '<script>alert(1)</script><img onerror="alert(2)">';
        const { container } = render(<ItemHeader data={{ ...data, itemName: payload }} page="draft" />);
        expect(screen.getByRole("heading", { name: payload })).toBeVisible();
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
