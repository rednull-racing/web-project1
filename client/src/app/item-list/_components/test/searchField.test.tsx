import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChangeEvent } from "react";
import { describe, expect, it, vi } from "vitest";
import styles from "../listParts.module.css";
import { SearchField } from "../searchField";

const createProps = (searchValue = "シャツ") => ({
    searchValue,
    onChange: vi.fn<(event: ChangeEvent<HTMLInputElement>) => void>(),
    onSubmit: vi.fn<() => void>(),
});

const getSearchIcon = (container: HTMLElement) => {
    // 現行アイコンにはrole・ラベルがないため、この境界だけ属性で取得する。
    const icon = container.querySelector<SVGSVGElement>('svg[name="search_icon"]');
    if (!icon) throw new Error("検索アイコンが見つかりません");
    return icon;
};

const inputValues = ["シャツ", "", "   ", "　"];

describe("SearchFieldの表示と制御値", () => {
    it("U-S01 標準入力を属性とともに表示する", () => {
        render(<SearchField {...createProps()} />);
        const input = screen.getByRole("textbox");
        expect(input).toHaveValue("シャツ");
        expect(input).toHaveAttribute("type", "text");
        expect(input).toHaveAttribute("name", "itemList_search");
        expect(input).toHaveAttribute("placeholder", "検索");
        expect(input).toHaveAttribute("autocomplete", "off");
    });

    it("U-S02 親の再描画で値を更新しコールバックを呼ばない", () => {
        const props = createProps();
        const { rerender } = render(<SearchField {...props} />);
        expect(screen.getByPlaceholderText("検索")).toHaveValue("シャツ");
        for (const searchValue of ["靴", ""]) {
            rerender(<SearchField {...props} searchValue={searchValue} />);
            expect(screen.getByRole("textbox")).toHaveValue(searchValue);
        }
        expect(props.onChange).not.toHaveBeenCalled();
        expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it("U-S03 空の入力へ一文字入力すると変更候補を一度通知する", async () => {
        const props = createProps("");
        const changes: { name: string; value: string }[] = [];
        props.onChange.mockImplementation((event) => {
            changes.push({ name: event.target.name, value: event.target.value });
        });
        render(<SearchField {...props} />);
        await userEvent.setup().type(screen.getByRole("textbox"), "あ");
        expect(props.onChange).toHaveBeenCalledOnce();
        expect(changes).toEqual([{ name: "itemList_search", value: "あ" }]);
        expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it("U-S04 変更候補の通知では値を確定せず親のpropsを反映する", async () => {
        const props = createProps();
        const changes: string[] = [];
        props.onChange.mockImplementation((event) => changes.push(event.target.value));
        const { rerender } = render(<SearchField {...props} />);
        const input = screen.getByRole("textbox");
        await userEvent.setup().type(input, "赤");
        expect(props.onChange).toHaveBeenCalledOnce();
        expect(changes).toEqual(["シャツ赤"]);
        expect(input).toHaveValue("シャツ");
        rerender(<SearchField {...props} searchValue="シャツ赤" />);
        expect(input).toHaveValue("シャツ赤");
        expect(props.onChange).toHaveBeenCalledOnce();
        expect(props.onSubmit).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "　", " シャツ "])(
        "U-S08 値%jの装飾はtrim結果で決まり入力値は加工しない",
        (searchValue) => {
            const { container } = render(<SearchField {...createProps(searchValue)} />);
            const icon = getSearchIcon(container);
            if (searchValue === " シャツ ") expect(icon).toHaveClass(styles.activeIcon);
            else expect(icon).not.toHaveClass(styles.activeIcon);
            expect(screen.getByRole("textbox")).toHaveValue(searchValue);
        },
    );
});

describe("SearchFieldの送信通知", () => {
    it.each(inputValues)("U-S05 値%jでもEnterで引数なしの送信を一度通知する", async (value) => {
        const props = createProps(value);
        render(<SearchField {...props} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("textbox"));
        await user.keyboard("{Enter}");
        expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith();
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it.each(inputValues)("U-S06 値%jでもアイコンから引数なしの送信を一度通知する", async (value) => {
        const props = createProps(value);
        const { container } = render(<SearchField {...props} />);
        await userEvent.setup().click(getSearchIcon(container));
        expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith();
        expect(props.onChange).not.toHaveBeenCalled();
    });

    it.each(["{Escape}", "{ArrowRight}", "{Tab}"])(
        "U-S07 %sでは送信を通知しない",
        async (key) => {
            const props = createProps();
            render(<SearchField {...props} />);
            const user = userEvent.setup();
            await user.click(screen.getByRole("textbox"));
            await user.keyboard(key);
            expect(props.onSubmit).not.toHaveBeenCalled();
            expect(props.onChange).not.toHaveBeenCalled();
        },
    );

    it.each(["click", "Enter"])("U-S09 %sを二回操作すると二回通知する", async (action) => {
        const props = createProps();
        const { container } = render(<SearchField {...props} />);
        const user = userEvent.setup();
        if (action === "click") {
            await user.click(getSearchIcon(container));
            expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith();
            await user.click(getSearchIcon(container));
        } else {
            await user.click(screen.getByRole("textbox"));
            await user.keyboard("{Enter}");
            expect(props.onSubmit).toHaveBeenCalledExactlyOnceWith();
            await user.keyboard("{Enter}");
        }
        expect(props.onSubmit.mock.calls).toEqual([[], []]);
        expect(props.onChange).not.toHaveBeenCalled();
    });
});
