import "@/../test/fixtures/item/itemConfirmPage/setup";
import { createConfirm } from "@/../test/fixtures/item/itemConfirmPage/fixtures";
import { ItemSection } from "@/app/item/confirm/itemSection";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { server } from "@/../test/fixtures/server";
import { http, HttpResponse } from "msw";

const API = "http://confirm-api.test";
describe("ItemSection実子部品", () => {
    it("C-N02 セール・バリエーション・配送・画像拡大をつなぐ", async () => {
        const data = createConfirm({ sale_flag: true, discount_rate: 20, discount_amount: 3000 });
        render(<ItemSection itemEditing={data} soldout={false} />);
        expect(screen.getByRole("heading", { name: "確認用シャツ" })).toBeInTheDocument();
        for (const text of ["￥12,000", "￥15,000", "20% OFF", "3,000円引き", "シャツ分類", "新品", "宅配便", "東京都", "1〜2日", "綿", "60%", "ポリエステル", "40%"]) {
            expect(screen.getByText(text)).toBeInTheDocument();
        }
        expect(screen.queryByText("確認ブランド")).not.toBeInTheDocument();
        expect(screen.queryByText("未使用の自由入力")).not.toBeInTheDocument();
        const user = userEvent.setup();
        const variant = screen.getByRole("button", { name: "赤" });
        await user.click(variant);
        expect(variant).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("M")).toBeInTheDocument();
        variant.focus(); await user.keyboard(" ");
        expect(variant).toHaveAttribute("aria-expanded", "false");
        const image = screen.getByRole("button", { name: "画像2を拡大" });
        await user.click(image);
        expect(screen.getAllByAltText(/全画面スライド/)).toHaveLength(3);
        await user.click(screen.getByRole("button", { name: "拡大画像を閉じる" }));
        expect(image).toHaveFocus();
    });
    it("C-N02 null補完・空variants・売切表示", () => {
        render(<ItemSection itemEditing={createConfirm({ detail: null, Category: null, ItemConditionOption: null,
            ShippingDayOption: null, ShippingServiceOption: null, TodouhukenOption: null, attributes: {} })} soldout />);
        expect(screen.getAllByText("-")).toHaveLength(4);
        expect(screen.getByText("SOLD OUT")).toBeInTheDocument();
        expect(screen.queryByText("￥12,000")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "赤" })).not.toBeInTheDocument();
        expect(screen.queryByText("null")).not.toBeInTheDocument();
    });
    it("C-N02 長文説明の開閉でも加点要求なし", async () => {
        const requests = vi.fn();
        server.use(http.all(`${API}/*`, () => { requests(); return HttpResponse.json({}); }));
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(200);
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
        render(<ItemSection itemEditing={createConfirm({ detail: "長い説明".repeat(100) })} soldout={false} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "...もっと見る" }));
        await user.click(screen.getByRole("button", { name: "閉じる" }));
        await act(async () => undefined);
        expect(requests).not.toHaveBeenCalled();
    });
});
