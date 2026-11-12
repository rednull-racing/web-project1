import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import ItemListUI from "../itemListUI";

const mocks = vi.hoisted(() => ({ container: vi.fn(), heading: vi.fn(), back: vi.fn() }));
vi.mock("@/components", () => ({
    Container: (props: { children: ReactNode; header?: boolean }) => {
        mocks.container(props);
        return <section data-testid="container">{props.children}</section>;
    },
    TitleAndBack: (props: { title: string }) => {
        mocks.heading(props);
        return <h1>{props.title}</h1>;
    },
    Back: (props: { url?: string }) => {
        mocks.back(props);
        return <button>戻る</button>;
    },
}));
const content = <><p>先頭</p><button>末尾</button></>;
describe("ItemListUIの包含契約", () => {
    it.each(["下書き商品", "", "<img src=x onerror=alert(1)>"])("U-I01 title=%sをそのまま渡し本文より先に表示する", (title) => {
        render(<ItemListUI title={title}>{content}</ItemListUI>);
        expect(mocks.heading).toHaveBeenCalledWith({ title });
        expect(screen.getByRole("heading").textContent).toBe(title);
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByTestId("container")).toContainElement(screen.getByRole("heading"));
        expect(screen.getByRole("heading").compareDocumentPosition(screen.getByText("先頭")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    it.each([false, true])("U-I02 空の子=%sでも枠の契約を維持する", (empty) => {
        const children = empty ? null : content;
        render(<ItemListUI title="一覧">{children}</ItemListUI>);
        expect(mocks.container.mock.calls[0][0]).not.toHaveProperty("header");
        expect(screen.getByTestId("container").textContent).toBe(empty ? "一覧" : "一覧先頭末尾");
    });
    it("U-I03 再描画で最新のタイトルと本文を渡す", () => {
        const { rerender } = render(<ItemListUI title="旧">旧本文</ItemListUI>);
        rerender(<ItemListUI title="新">新本文</ItemListUI>);
        expect(screen.getByTestId("container").textContent).toBe("新新本文");
        expect(mocks.heading).toHaveBeenLastCalledWith({ title: "新" });
    });
});
