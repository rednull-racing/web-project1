import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Detail } from "../detail";
const sort = vi.hoisted(() => vi.fn());
vi.mock("../../api/itemSection", () => ({ fetchItemSortAdd: sort }));
const data = { itemId: null, detail: "下書きの商品説明", soldout: false };

describe("商品説明", () => {
    it("U-N09 短文は展開操作を表示しない", () => {
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(40);
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
        render(<Detail data={data} normalPage={false} />);
        expect(screen.getByText(data.detail)).toBeVisible();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
    it("U-N09 長文を開閉しても下書きの集計APIを呼ばない", async () => {
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
        const { rerender } = render(<Detail data={data} normalPage={false} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "...もっと見る" }));
        expect(screen.getByText(data.detail)).toHaveStyle({ maxHeight: "120px" });
        await user.click(screen.getByRole("button", { name: "閉じる" }));
        expect(screen.getByRole("button", { name: "...もっと見る" })).toBeVisible();
        expect(sort).not.toHaveBeenCalled();
        rerender(<Detail data={{ ...data, detail: "変更後" }} normalPage={false} />);
        expect(screen.getByText("変更後")).toBeVisible();
    });
    it("U-S01 HTMLとして描画しない", () => {
        const payload = '<script>alert(1)</script><img onerror="alert(2)">';
        const { container } = render(<Detail data={{ ...data, detail: payload }} normalPage={false} />);
        expect(screen.getByText(payload)).toBeVisible();
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
