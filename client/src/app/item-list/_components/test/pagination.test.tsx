import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { Pagination } from "../pagination";
import styles from "../listParts.module.css";

type Props = ComponentProps<typeof Pagination>;
const widthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
const setWidth = (width: number) => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
};
const createProps = (overrides: Partial<Props> = {}): Props => ({
    currentPage: 5,
    totalPages: 10,
    onPageChange: vi.fn<(page: number) => void>(),
    ...overrides,
});
const expectPages = (container: HTMLElement, pages: string[]) => {
    const buttons = screen.getAllByRole("button");
    const numbers = buttons.filter((button) => /^\d+$/.test(button.textContent ?? ""));
    expect(new Set(numbers.map((button) => button.textContent)).size).toBe(numbers.length);
    expect(buttons.every((button) => button.getAttribute("type") === "button")).toBe(true);
    expect(screen.getByTitle("前へ")).toHaveAttribute("type", "button");
    expect(screen.getByTitle("次へ")).toHaveAttribute("type", "button");
    expect(
        Array.from(container.querySelectorAll("button, span"))
            .map((element) => element.textContent?.trim() ?? "")
            .filter((text) => /^\d+$/.test(text) || text === "..."),
    ).toEqual(pages);
};

beforeEach(() => setWidth(768));
afterEach(() => {
    if (widthDescriptor) Object.defineProperty(window, "innerWidth", widthDescriptor);
});

describe("Pagination 表示条件とページ列", () => {
    it.each([-1, 0, 1])("U-P01 総数%sでは何も描画・通知しない", (totalPages) => {
        const props = createProps({ totalPages });
        const { container } = render(<Pagination {...props} />);
        expect(container).toBeEmptyDOMElement();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
        expect(screen.queryByText("...")).not.toBeInTheDocument();
        expect(props.onPageChange).not.toHaveBeenCalled();
    });

    it.each([
        [767, 1], [767, 2], [768, 1], [768, 2],
    ])("U-P02 幅%s・現在%sで2ページを省略せず端の操作だけ無効化する", (width, currentPage) => {
        setWidth(width);
        const { container } = render(<Pagination {...createProps({ currentPage, totalPages: 2 })} />);
        expectPages(container, ["1", "2"]);
        expect(screen.getByTitle("前へ")).toHaveProperty("disabled", currentPage === 1);
        expect(screen.getByTitle("次へ")).toHaveProperty("disabled", currentPage === 2);
    });

    it.each([
        { width: 767, pages: ["1", "...", "4", "5", "6", "...", "10"] },
        { width: 768, pages: ["1", "2", "3", "4", "5", "6", "7", "...", "10"] },
    ])("U-P03 入力%jで768px境界に応じた周辺ページを表示する", ({ width, pages }) => {
        setWidth(width);
        const { container } = render(<Pagination {...createProps()} />);
        expectPages(container, pages);
    });

    it.each([
        { currentPage: 1, pages: ["1", "2", "3", "...", "10"] },
        { currentPage: 10, pages: ["1", "...", "8", "9", "10"] },
    ])("U-P04 入力%jで端点を重複させず表示する", ({ currentPage, pages }) => {
        const { container } = render(<Pagination {...createProps({ currentPage })} />);
        expectPages(container, pages);
    });

    it.each([
        { currentPage: 3, pages: ["1", "2", "3", "4", "...", "10"] },
        { currentPage: 4, pages: ["1", "...", "3", "4", "5", "...", "10"] },
    ])("U-P05 入力%jで左側の省略条件を判定する", ({ currentPage, pages }) => {
        setWidth(767);
        const { container } = render(<Pagination {...createProps({ currentPage })} />);
        expectPages(container, pages);
    });

    it.each([
        { currentPage: 7, pages: ["1", "...", "6", "7", "8", "...", "10"] },
        { currentPage: 8, pages: ["1", "...", "7", "8", "9", "10"] },
    ])("U-P06 入力%jで右側の省略条件を判定する", ({ currentPage, pages }) => {
        setWidth(767);
        const { container } = render(<Pagination {...createProps({ currentPage })} />);
        expectPages(container, pages);
    });

    it("U-P07 周辺範囲に収まる5ページはすべて表示する", () => {
        const { container } = render(<Pagination {...createProps({ currentPage: 3, totalPages: 5 })} />);
        expectPages(container, ["1", "2", "3", "4", "5"]);
    });
});

describe("Pagination 操作通知と再描画", () => {
    it.each([1, 4, 5, 10])("U-P08 数値%sのクリックを一度通知し親の現在ページを維持する", async (page) => {
        const props = createProps();
        render(<Pagination {...props} />);
        await userEvent.setup().click(screen.getByRole("button", { name: String(page) }));
        expect(props.onPageChange).toHaveBeenCalledExactlyOnceWith(page);
        expect(screen.getByRole("button", { name: "5" })).toHaveClass(styles.active);
    });

    it.each([
        ["前へ", 4], ["次へ", 6],
    ] as const)("U-P09 %sをクリックすると%sを通知し現在ページを維持する", async (title, page) => {
        const props = createProps();
        render(<Pagination {...props} />);
        await userEvent.setup().click(screen.getByTitle(title));
        expect(props.onPageChange).toHaveBeenCalledExactlyOnceWith(page);
        expect(screen.getByRole("button", { name: "5" })).toHaveClass(styles.active);
    });

    it.each([
        { currentPage: 1, disabledTitle: "前へ", enabledTitle: "次へ", nextPage: 2, pages: ["1", "2", "3", "...", "10"] },
        { currentPage: 10, disabledTitle: "次へ", enabledTitle: "前へ", nextPage: 9, pages: ["1", "...", "8", "9", "10"] },
    ])("U-P10 入力%jで無効な端点操作を通知せず反対側を通知する", async ({ currentPage, disabledTitle, enabledTitle, nextPage, pages }) => {
        const props = createProps({ currentPage });
        const { container } = render(<Pagination {...props} />);
        const user = userEvent.setup();
        expectPages(container, pages);
        expect(screen.getByTitle(disabledTitle)).toBeDisabled();
        await user.click(screen.getByTitle(disabledTitle));
        expect(props.onPageChange).not.toHaveBeenCalled();
        expect(screen.getByTitle(enabledTitle)).toBeEnabled();
        await user.click(screen.getByTitle(enabledTitle));
        expect(props.onPageChange).toHaveBeenCalledExactlyOnceWith(nextPage);
    });

    it("U-P11 省略表示はボタンではなくクリックしても通知しない", async () => {
        const props = createProps();
        render(<Pagination {...props} />);
        for (const ellipsis of screen.getAllByText("...")) {
            expect(ellipsis.tagName).toBe("SPAN");
            expect(ellipsis.closest("button")).toBeNull();
            await userEvent.setup().click(ellipsis);
        }
        expect(props.onPageChange).not.toHaveBeenCalled();
    });

    it("U-P12 親の現在ページ変更でactiveとページ列を更新する", () => {
        const props = createProps();
        const { container, rerender } = render(<Pagination {...props} />);
        expect(screen.getByRole("button", { name: "5" })).toHaveClass(styles.active);
        rerender(<Pagination {...props} currentPage={6} />);
        expectPages(container, ["1", "...", "4", "5", "6", "7", "8", "...", "10"]);
        expect(screen.getByRole("button", { name: "5" })).not.toHaveClass(styles.active);
        expect(screen.getByRole("button", { name: "6" })).toHaveClass(styles.active);
        expect(screen.getAllByRole("button").filter((button) => button.classList.contains(styles.active))).toHaveLength(1);
        expect(props.onPageChange).not.toHaveBeenCalled();
    });

    it("U-P13 幅を変更して再描画すると同じpropsでもページ列を再計算する", () => {
        setWidth(767);
        const props = createProps();
        const { container, rerender } = render(<Pagination {...props} />);
        expectPages(container, ["1", "...", "4", "5", "6", "...", "10"]);
        setWidth(768);
        rerender(<Pagination {...props} />);
        expectPages(container, ["1", "2", "3", "4", "5", "6", "7", "...", "10"]);
        expect(props.onPageChange).not.toHaveBeenCalled();
    });
});
