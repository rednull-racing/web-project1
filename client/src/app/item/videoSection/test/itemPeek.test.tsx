import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemPeek } from "../itemPeek";
const data = { itemName: "下書きシャツ", price: 800, firstImageUrl: "/one.png", genderType: "men" as const, ageType: "adult" as const, soldout: false };

describe("商品概要", () => {
    it.each([
        ["men", "adult", "メンズ", null], ["women", "kids", "レディース", "キッズ"], ["unisex", "both", "ユニセックス", null],
    ] as const)("U-N08 性別%s 年齢%sを表示", (genderType, ageType, genderLabel, ageLabel) => {
        render(<ItemPeek data={{ ...data, genderType, ageType }} />);
        expect(screen.getByText(data.itemName)).toBeVisible();
        expect(screen.getByText("￥800")).toBeVisible();
        expect(screen.getByAltText("商品画像1枚目")).toBeVisible();
        expect(screen.getByText(genderLabel)).toBeVisible();
        if (ageLabel) expect(screen.getByText(ageLabel)).toBeVisible();
        else expect(screen.queryByText("キッズ")).not.toBeInTheDocument();
    });
    it("U-N08 売切れ時は価格をSOLD OUTへ置き換える", () => {
        render(<ItemPeek data={{ ...data, soldout: true }} />);
        expect(screen.getByText("SOLD OUT")).toBeVisible();
        expect(screen.queryByText("￥800")).not.toBeInTheDocument();
    });
    it("U-N08 クリックで商品名へスクロールする", async () => {
        const scroll = vi.fn();
        const { container } = render(<><ItemPeek data={data} /><h1 id="itemName">商品名</h1></>);
        Object.defineProperty(container.querySelector("#itemName"), "scrollIntoView", { value: scroll, configurable: true });
        await userEvent.click(screen.getByRole("button", { name: "商品説明へスクロール" }));
        expect(scroll).toHaveBeenCalledExactlyOnceWith({ behavior: "smooth", block: "start" });
    });
    it("U-N08 スクロール標的がなくてもクリックできる", async () => {
        render(<ItemPeek data={data} />);
        await userEvent.click(screen.getByRole("button", { name: "商品説明へスクロール" }));
        expect(screen.getByText(data.itemName)).toBeVisible();
    });
    it.each(["{Enter}", " "])("Q05 キーボード%sだけで到達・起動できる", async (key) => {
        const scroll = vi.fn();
        const { container } = render(<><ItemPeek data={data} /><h1 id="itemName">商品名</h1></>);
        Object.defineProperty(container.querySelector("#itemName"), "scrollIntoView", { value: scroll, configurable: true });
        const user = userEvent.setup();
        await user.tab();
        expect(screen.getByRole("button", { name: "商品説明へスクロール" })).toHaveFocus();
        await user.keyboard(key);
        expect(scroll).toHaveBeenCalledTimes(1);
    });
    it("U-S01 HTML文字列を実行可能要素に変換しない", () => {
        const payload = '<img src=x onerror="alert(1)"><script>alert(2)</script>';
        const { container } = render(<ItemPeek data={{ ...data, itemName: payload }} />);
        expect(screen.getByText(payload)).toBeVisible();
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
