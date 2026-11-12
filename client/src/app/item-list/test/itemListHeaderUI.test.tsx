import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import ItemListHeaderUI from "../itemListHeaderUI";

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
const content = (
    <>
        <p>先頭</p>
        <button>末尾</button>
    </>
);
describe("ItemListHeaderUIの包含契約", () => {
    it("U-H01 戻るを子より先に置き指定外のPropsを追加しない", () => {
        render(<ItemListHeaderUI>{content}</ItemListHeaderUI>);
        expect(screen.getByTestId("container").textContent).toBe("戻る先頭末尾");
        expect(mocks.back.mock.calls[0][0]).not.toHaveProperty("url");
        expect(mocks.container.mock.calls[0][0]).not.toHaveProperty("header");
    });
    it("U-H02 子がnullでも戻るだけを維持する", () => {
        render(<ItemListHeaderUI>{null}</ItemListHeaderUI>);
        expect(screen.getByTestId("container").textContent).toBe("戻る");
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });
    it("U-H03 子を更新しても戻るは重複しない", () => {
        const { rerender } = render(<ItemListHeaderUI>旧本文</ItemListHeaderUI>);
        rerender(<ItemListHeaderUI>新本文</ItemListHeaderUI>);
        expect(screen.getByTestId("container").textContent).toBe("戻る新本文");
        expect(screen.getAllByRole("button")).toHaveLength(1);
    });
});
