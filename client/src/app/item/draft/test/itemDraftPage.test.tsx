import { render, screen } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";
import { createDraft } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { ItemDraftPage } from "../itemDraftPage";

const mocks = vi.hoisted(() => ({ video: vi.fn(), item: vi.fn(), edit: vi.fn(), remove: vi.fn() }));
vi.mock("@/components", () => ({ Container: ({ children }: PropsWithChildren) => <div>{children}</div> }));
vi.mock("../videoSection", () => ({
    VideoSection: (props: unknown) => {
        mocks.video(props);
        return <section>動画</section>;
    },
}));
vi.mock("../itemSection", () => ({
    ItemSection: (props: unknown) => {
        mocks.item(props);
        return <section>商品</section>;
    },
}));
vi.mock("../editButton", () => ({
    EditButton: (props: unknown) => {
        mocks.edit(props);
        return <button>編集する</button>;
    },
}));
vi.mock("../delete", () => ({
    DeleteItemDraft: (props: unknown) => {
        mocks.remove(props);
        return <button>削除</button>;
    },
}));

describe("ItemDraftPage 単体", () => {
    it("U-N01 上編集・mainの動画/商品・下編集・削除の順とIDを保持する", () => {
        const draft = createDraft();
        const { container } = render(<ItemDraftPage id="11" itemDraft={draft} />);
        const children = container.firstElementChild?.children;
        expect(Array.from(children ?? []).map((node) => node.textContent)).toEqual([
            "編集する",
            "動画商品",
            "編集する",
            "削除",
        ]);
        expect(screen.getAllByRole("button", { name: "編集する" })).toHaveLength(2);
        expect(mocks.edit).toHaveBeenCalledTimes(2);
        expect(mocks.edit).toHaveBeenNthCalledWith(1, { id: "11" });
        expect(mocks.edit).toHaveBeenNthCalledWith(2, { id: "11" });
        expect(mocks.remove).toHaveBeenCalledWith({ id: "11" });
        expect(mocks.video).toHaveBeenCalledWith({ itemDraft: draft, soldout: false });
        expect(mocks.item).toHaveBeenCalledWith({ itemDraft: draft, soldout: false });
    });
    it.each([
        [0, true],
        [1, false],
        [undefined, false],
    ] as const)("U-V01 current=%s のsoldoutは%s", (current, expected) => {
        const draft = createDraft({
            attributes: current === undefined ? {} : { inventory: { initial: 10, current, low_stock_ratio: 0.2 } },
        });
        render(<ItemDraftPage id="11" itemDraft={draft} />);
        expect(mocks.video).toHaveBeenCalledWith({ itemDraft: draft, soldout: expected });
        expect(mocks.item).toHaveBeenCalledWith({ itemDraft: draft, soldout: expected });
    });
});
