import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Detail } from "../detail";
const sort = vi.hoisted(() => vi.fn());
vi.mock("../../api/itemSection", () => ({ fetchItemSortAdd: sort }));
it.each([false, true])("U-S05 confirm詳細はnormalPage省略・soldout=%sで加点しない", async (soldout) => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(120);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(40);
    render(<Detail data={{ itemId: null, detail: "確認画面の長い説明", soldout }} />);
    await userEvent.click(screen.getByRole("button", { name: "...もっと見る" }));
    expect(screen.getByText("確認画面の長い説明")).toHaveStyle({ maxHeight: "120px" });
    await userEvent.click(screen.getByRole("button", { name: "閉じる" }));
    expect(sort).not.toHaveBeenCalled();
});
it("U-S05 空詳細はもっと見るを表示しない", () => {
    vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(0);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(0);
    render(<Detail data={{ itemId: null, detail: "", soldout: false }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
