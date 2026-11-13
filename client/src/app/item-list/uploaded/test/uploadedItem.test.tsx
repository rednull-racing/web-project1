import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UploadedItem } from "../uploadedItem";
import { mount } from "../../../../../test/fixtures/item-list/uploaded/setup";
import { row } from "../../../../../test/fixtures/item-list/uploaded/fixtures";
describe("uploaded row", () => {
    it.each([
        ["men", "メンズ"],
        ["women", "レディース"],
        ["unisex", "ユニセックス"],
    ] as const)("U-N02 %s の商品詳細・ラベル・価格", (gender_type, label) => {
        mount(<UploadedItem item={row({ gender_type, age_type: "kids" })} mutate={vi.fn()} />);
        expect(screen.getByRole("link")).toHaveAttribute("href", "/item/101");
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText("キッズ")).toBeInTheDocument();
        expect(screen.getByText("1,200円")).toBeInTheDocument();
        expect(screen.getByText("紹介動画")).toBeInTheDocument();
    });
    it("U-V02 nullable項目・売切れ・Sale数値文字列", () => {
        mount(
            <UploadedItem
                item={row({
                    name: null,
                    Video: null,
                    uploaded_at: null,
                    status: "soldout",
                    Sale: { sale_flag: true, before_price: "2000", discount_rate: "40", discount_amount: null },
                })}
                mutate={vi.fn()}
            />,
        );
        expect(screen.getByRole("heading", { level: 2 })).toBeEmptyDOMElement();
        expect(screen.getByRole("heading", { level: 4 })).toBeEmptyDOMElement();
        expect(decodeURIComponent(screen.getByRole("img").getAttribute("src") ?? "")).toContain("/no-image(1x1).png");
        expect(screen.getByText("SOLD")).toBeInTheDocument();
        expect(screen.getByText("2,000円")).toBeInTheDocument();
        expect(screen.getByText("40% OFF")).toBeInTheDocument();
        expect(screen.queryByText("キッズ")).not.toBeInTheDocument();
    });
});
