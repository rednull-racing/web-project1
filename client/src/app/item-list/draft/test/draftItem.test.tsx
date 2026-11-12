import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import { DraftItem } from "../draftItem";
import { ItemImage } from "../../_components/itemImage";
import { ItemPrice } from "../../_components/itemPrice";
import { RemoveFloat } from "../removeFloat";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
vi.mock("../../_components/itemImage", () => ({ ItemImage: vi.fn(() => null) }));
vi.mock("../../_components/itemPrice", () => ({ ItemPrice: vi.fn(() => null) }));
vi.mock("../removeFloat", () => ({ RemoveFloat: vi.fn(() => <button>削除境界</button>) }));
vi.mock("@/lib/formatRelativeTime", () => ({ formatRelativeTime: vi.fn(() => "1時間前") }));
const fixture = (): ComponentProps<typeof DraftItem> => ({
    itemDraft: {
        id: 101,
        name: "検証用シャツ",
        title: "動画A",
        price: 12345,
        first_image_url: "/test-item.jpg",
        createdAt: "2026-11-11T23:00:00Z",
    },
    mutate: vi.fn(),
});
describe("DraftItem境界", () => {
    it("U-I01 商品表示・子の引数・リンク外の削除を保証する", () => {
        const props = fixture();
        render(<DraftItem {...props} />);
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "/item/draft/101");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("検証用シャツ");
        expect(screen.getByText("動画A")).toBeInTheDocument();
        expect(screen.getByText("保存日時:")).toBeInTheDocument();
        expect(screen.getByText("1時間前")).toBeInTheDocument();
        expect(formatRelativeTime).toHaveBeenCalledWith(props.itemDraft.createdAt);
        expect(vi.mocked(ItemImage).mock.calls[0][0]).toEqual({
            data: { first_image_url: "/test-item.jpg", status: null },
            showSold: false,
        });
        expect(vi.mocked(ItemPrice).mock.calls[0][0]).toEqual({
            data: { price: 12345, sale_flag: false, before_price: 0, discount_rate: 0, discount_amount: 0 },
            showSale: false,
        });
        expect(vi.mocked(RemoveFloat).mock.calls[0][0]).toEqual({ itemDraftId: 101, mutate: props.mutate });
        expect(link).not.toContainElement(screen.getByRole("button"));
    });
    it.each([null])("U-I02 nullable値%sを空文字表示する", (value) => {
        const props = fixture();
        // APIのnullable値に対する防御分岐を直接検証する。
        Object.assign(props.itemDraft, { name: value, title: value, first_image_url: "" });
        render(<DraftItem {...props} />);
        expect(screen.getByRole("heading", { level: 2 })).toBeEmptyDOMElement();
        expect(screen.getByRole("heading", { level: 4 })).toBeEmptyDOMElement();
        expect(vi.mocked(ItemImage).mock.calls[0][0].data.first_image_url).toBe("");
    });
});

 it("AF-I01 null価格をプレースホルダーへ変換する", () => { const props = fixture(); props.itemDraft.price = null; render(<DraftItem {...props}/>); expect(vi.mocked(ItemPrice).mock.calls[0][0].data.price).toBe("-"); });
