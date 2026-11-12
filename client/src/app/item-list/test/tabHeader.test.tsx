import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import styles from "../header.module.css";
import { TabHeader } from "../tabHeader";

const { push } = vi.hoisted(() => ({ push: vi.fn<(url: string) => void>() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const tabs = [
    { tab: "all", label: "全商品", name: "all-tab" },
    { tab: "selling", label: "販売中のみ", name: "selling-tab" },
    { tab: "sold", label: "売り切れ", name: "sold" },
] as const;

const expectActive = (label: string) => {
    const buttons = within(screen.getByRole("navigation")).getAllByRole("button");
    expect(buttons.filter((button) => button.classList.contains(styles.active))).toHaveLength(1);
    expect(screen.getByRole("button", { name: label })).toHaveClass(styles.active);
};

describe("TabHeaderの表示と選択状態", () => {
    it("U-T01 3ボタンを所定の順序・文言・属性で表示する", () => {
        render(<TabHeader tab="all" />);
        const buttons = within(screen.getByRole("navigation")).getAllByRole("button");
        expect(buttons.map((button) => button.textContent)).toEqual(tabs.map(({ label }) => label));
        buttons.forEach((button, index) => {
            expect(button).toHaveAttribute("type", "button");
            expect(button).toHaveAttribute("name", tabs[index].name);
            expect(button).toBeEnabled();
        });
        expect(push).not.toHaveBeenCalled();
    });

    it.each(tabs)("U-T02 入力%jだけを選択状態にする", ({ tab, label }) => {
        render(<TabHeader tab={tab} />);
        expectActive(label);
        expect(push).not.toHaveBeenCalled();
    });

    it("U-T04 親の再描画で選択状態を更新し遷移を要求しない", () => {
        const { rerender } = render(<TabHeader tab="all" />);
        expectActive("全商品");
        rerender(<TabHeader tab="sold" />);
        expectActive("売り切れ");
        expect(screen.getByRole("button", { name: "全商品" })).not.toHaveClass(styles.active);
        expect(push).not.toHaveBeenCalled();
    });
});

describe("TabHeaderの遷移要求", () => {
    it.each(tabs.flatMap((current) => tabs.map((target) => ({ current, target }))))(
        "U-T03 入力%jのクリックは対応URLを一度要求する",
        async ({ current, target }) => {
            render(<TabHeader tab={current.tab} />);
            await userEvent.setup().click(screen.getByRole("button", { name: target.label }));
            expect(push).toHaveBeenCalledExactlyOnceWith(`/item-list/uploaded?tab=${target.tab}`);
            expectActive(current.label);
        },
    );

    it.each(["{Enter}", " "])("U-T05 %jによるボタン操作で遷移を一度要求する", async (key) => {
        render(<TabHeader tab="all" />);
        screen.getByRole("button", { name: "販売中のみ" }).focus();
        await userEvent.setup().keyboard(key);
        expect(push).toHaveBeenCalledExactlyOnceWith("/item-list/uploaded?tab=selling");
        expectActive("全商品");
    });

    it("U-T06 同じボタンの連続クリックは操作ごとに遷移を要求する", async () => {
        render(<TabHeader tab="sold" />);
        const user = userEvent.setup();
        const button = screen.getByRole("button", { name: "売り切れ" });
        await user.click(button);
        await user.click(button);
        expect(push.mock.calls).toEqual([
            ["/item-list/uploaded?tab=sold"],
            ["/item-list/uploaded?tab=sold"],
        ]);
        expectActive("売り切れ");
    });
});
