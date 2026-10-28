import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { VariantsList } from "../variantsList";
import styles from "../variants.module.css";
import type { ItemAttributes } from "../../../../types/itemAttributes";
const variant = (color: string, current = 4) => ({
    color, image_url: "/variant.png", inventory: { initial: 10, current, low_stock_ratio: 0.2 },
    sizes: [{ size: "M", inventory: { initial: 10, current, low_stock_ratio: 0.2 } }],
});

function cardFor(label: string) {
    const card = screen.getByText(label).closest(`.${styles.variantCard}`);
    expect(card).not.toBeNull();
    return card as HTMLElement;
}

describe("バリエーション", () => {
    it("U-N12 2色のカードを開閉し別カードへ切り替える", async () => {
        render(<VariantsList itemAttributes={{ colorVariants: [variant("赤"), variant("青", 0)] }} />);
        expect(screen.getAllByAltText("バリエーション画像")).toHaveLength(2);
        expect(within(cardFor("青")).getByText("SOLD")).toBeVisible();
        expect(within(cardFor("青")).queryByText("残りわずか")).not.toBeInTheDocument();
        const user = userEvent.setup();
        await user.click(screen.getByText("赤"));
        expect(cardFor("赤")).toHaveClass(styles.active);
        await user.click(screen.getByText("青"));
        expect(cardFor("赤")).not.toHaveClass(styles.active);
        expect(cardFor("青")).toHaveClass(styles.active);
        await user.click(screen.getByText("青"));
        expect(cardFor("青")).not.toHaveClass(styles.active);
    });
    it("U-N12 サイズなしの1色カードも表示する", () => {
        const color = variant("緑");
        const { sizes: _sizes, ...withoutSizes } = color;
        void _sizes;
        render(<VariantsList itemAttributes={{ colorVariants: [withoutSizes] }} />);
        expect(screen.getByText("緑")).toBeVisible();
        expect(screen.queryByText("M")).not.toBeInTheDocument();
    });
    it.each([[0, "SOLD"], [1, "残りわずか"], [2, "残りわずか"], [3, null]] as const)("U-V05 色在庫%sの表示%s", (current, expected) => {
        render(<VariantsList itemAttributes={{ colorVariants: [variant("赤", current)] }} />);
        if (expected) expect(screen.getByText(expected)).toBeVisible();
        else expect(screen.queryByText(/SOLD|残りわずか/)).not.toBeInTheDocument();
    });
    it("U-V05 色在庫省略はSOLD表示", () => {
        render(<VariantsList itemAttributes={{ colorVariants: [{ color: "赤", image_url: "/variant.png" }] }} />);
        expect(screen.getByText("SOLD")).toBeVisible();
        expect(screen.queryByText("残りわずか")).not.toBeInTheDocument();
    });
    it.each([0, 2, 3, 4])("Q09 色在庫%sは設定ratio0.3以下で低在庫表示", (current) => {
        const color = variant("赤", current);
        color.inventory.low_stock_ratio = 0.3;
        render(<VariantsList itemAttributes={{ colorVariants: [color] }} />);
        expect(Boolean(screen.queryByText("SOLD"))).toBe(current === 0);
        expect(Boolean(screen.queryByText("残りわずか"))).toBe(current > 0 && current <= 3);
    });
    it.each([0, 2, 3, 4])("Q09 サイズ在庫%sは設定ratio0.3以下で低在庫表示", (current) => {
        const color = variant("赤", current);
        color.sizes[0].inventory.low_stock_ratio = 0.3;
        render(<VariantsList itemAttributes={{ colorVariants: [color] }} />);
        const chip = screen.getByText("M");
        if (current === 0) expect(chip).toHaveClass(styles.soldChip);
        else expect(chip).not.toHaveClass(styles.soldChip);
        if (current > 0 && current <= 3) expect(chip).toHaveClass(styles.lowChip);
        else expect(chip).not.toHaveClass(styles.lowChip);
    });
    it("Q08 バリエーションをキーボードだけで開閉できる", async () => {
        render(<VariantsList itemAttributes={{ colorVariants: [variant("赤")] }} />);
        const user = userEvent.setup();
        await user.tab();
        expect(cardFor("赤")).toHaveFocus();
        await user.keyboard("{Enter}");
        expect(cardFor("赤")).toHaveClass(styles.active);
        await user.keyboard(" ");
        expect(cardFor("赤")).not.toHaveClass(styles.active);
    });
    it("U-S01 色名とサイズをHTMLとして描画しない", () => {
        const payload = '<script>alert(1)</script><img onerror="alert(2)">';
        const color = variant(payload);
        color.sizes[0].size = payload;
        const itemAttributes: ItemAttributes = { colorVariants: [color] };
        const { container } = render(<VariantsList itemAttributes={itemAttributes} />);
        expect(screen.getAllByText(payload)).toHaveLength(2);
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });
});
