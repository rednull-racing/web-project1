import { render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { expect, it, vi } from "vitest";
import { createEditing } from "./fixtures";
import { ItemConfirmPage } from "../itemConfirmPage";
const mocks = vi.hoisted(() => ({ video: vi.fn(), item: vi.fn(), upload: vi.fn(), title: vi.fn() }));
vi.mock("@/components", () => ({ Container: ({ children }: PropsWithChildren) => <div>{children}</div>, Back: () => <button>戻る</button> }));
vi.mock("../title", () => ({ Title: (props: unknown) => { mocks.title(props); return <p>タイトル</p>; } }));
vi.mock("../videoSection", () => ({ VideoSection: (props: unknown) => { mocks.video(props); return <section>動画</section>; } }));
vi.mock("../itemSection", () => ({ ItemSection: (props: unknown) => { mocks.item(props); return <section>商品</section>; } }));
vi.mock("../uploadButton", () => ({ UploadButton: (props: unknown) => { mocks.upload(props); return <button>出品</button>; } }));
it.each(["normal", "edit"] as const)("U-N02 %sの構成とpage/id伝播", (page) => {
    const itemEditing = createEditing({ status: page === "normal" ? "edit" : "normal" });
    const { container } = render(<ItemConfirmPage id="101" itemEditing={itemEditing} page={page} />);
    expect(Array.from(container.firstElementChild?.children ?? []).map(node => node.textContent)).toEqual(["タイトル", "戻る", "動画商品", "出品"]);
    expect(mocks.title).toHaveBeenCalledWith({ page });
    expect(mocks.upload).toHaveBeenCalledWith({ id: "101", page });
});
it.each([[0, true], [1, false], [undefined, false]] as const)("U-N02 在庫%sのsoldout=%s", (current, soldout) => {
    const itemEditing = createEditing({ attributes: current === undefined ? {} : { inventory: { initial: 10, current, low_stock_ratio: 0.2 } } });
    render(<ItemConfirmPage id="101" itemEditing={itemEditing} page="normal" />);
    expect(mocks.video).toHaveBeenCalledWith({ itemEditing, soldout });
    expect(mocks.item).toHaveBeenCalledWith({ itemEditing, soldout });
});
