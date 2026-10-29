import "@/../test/fixtures/item/itemDraftPage/setup";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import styles from "@/app/item/itemSection/variants.module.css";
import { ItemSection } from "@/app/item/draft/itemSection";
import { createDraft, createEmptyDraft } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { server } from "@/../test/fixtures/server";
import { http, HttpResponse } from "msw";

describe("ItemSection real shared components", () => {
    it.each(["full", "empty"])("C-N03: %s fixtureの表示と補完", (kind) => {
        const empty = kind === "empty";
        const { container } = render(
            <ItemSection itemDraft={empty ? createEmptyDraft() : createDraft()} soldout={false} />,
        );
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(empty ? "商品名未入力" : "下書きシャツ");
        expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(empty ? "￥-" : "￥800");
        expect(container.querySelector('[data-icon="fire"]')).toBeNull();
        const images = screen.getAllByRole("img");
        expect(images[0]).toHaveAttribute("src", empty ? "/no-image(1x1).png" : "/test-image-1.png");
        if (empty) {
            expect(screen.queryByAltText("バリエーション画像")).not.toBeInTheDocument();
            expect(screen.getAllByText("-")).toHaveLength(4);
            expect(screen.queryByText("25% OFF")).not.toBeInTheDocument();
        } else {
            for (const text of [
                "25% OFF",
                "400円引き",
                "￥1,200",
                "新品",
                "指定配送",
                "東京都",
                "1〜2日",
                "シャツ",
                "商品説明の本文",
            ])
                expect(screen.getByText(text)).toBeInTheDocument();
            expect(screen.getAllByAltText("バリエーション画像")).toHaveLength(2);
        }
    });

    it("C-N04: 実Detailが開閉し集計HTTPを呼ばない", async () => {
        vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(100);
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(20);
        const reached = vi.fn();
        server.use(
            http.all("*", () => {
                reached();
                return HttpResponse.json({});
            }),
        );
        render(<ItemSection itemDraft={createDraft()} soldout={false} />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "...もっと見る" }));
        expect(screen.getByRole("button", { name: "閉じる" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "閉じる" }));
        expect(screen.getByRole("button", { name: "...もっと見る" })).toBeInTheDocument();
        expect(reached).not.toHaveBeenCalled();
    });

    it("C-S01: HTML風の文字列を商品名・説明・カテゴリーで実行しない", () => {
        const text = '<script>window.compromised=true</script><img src=x onerror="alert(1)">';
        const item = createEmptyDraft();
        item.name = text;
        item.detail = text;
        item.Category = {
            id: 1,
            name: text,
            parent: null,
            children: [],
        };
        const { container } = render(<ItemSection itemDraft={item} soldout={false} />);
        expect(screen.getAllByText(text)).toHaveLength(3);
        expect(container.querySelector("script, [onerror]")).toBeNull();
    });

    it.each([2, 3, 4].flatMap((initial) => [1, 2].map((current) => ({ initial, current }))))(
        "Q07: 少量在庫%jも文言を表示",
        ({ initial, current }) => {
            render(<ItemSection itemDraft={createEmptyDraftWithInventory(initial, current)} soldout={false} />);
            const row = screen.getByText("在庫").parentElement!;
            expect(within(row).getByText(current === 1 ? "残りわずか" : "在庫あり")).toBeInTheDocument();
        },
    );
    it.each([0, 2, 3, 4])("Q09: 実バリエーションの在庫%sで個別閾値を適用", (current) => {
        const draft = createEmptyDraft();
        draft.attributes = {
            colorVariants: [
                {
                    color: "赤",
                    image_url: "/red.png",
                    inventory: { initial: 10, current, low_stock_ratio: 0.3 },
                    sizes: [{ size: "M", inventory: { initial: 10, current, low_stock_ratio: 0.3 } }],
                },
            ],
        };
        render(<ItemSection itemDraft={draft} soldout={false} />);
        expect(screen.queryByText("残りわずか") !== null).toBe(current > 0 && current <= 3);
        const chip = screen.getByText("M");
        expect(chip.classList.contains(styles.lowChip)).toBe(current > 0 && current <= 3);
        expect(chip.classList.contains(styles.soldChip)).toBe(current === 0);
    });
});

function createEmptyDraftWithInventory(initial: number, current: number) {
    return { ...createEmptyDraft(), attributes: { inventory: { initial, current, low_stock_ratio: 0.2 } } };
}
