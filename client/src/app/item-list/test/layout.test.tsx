import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import ItemListLayout from "../layout";

const boundary = vi.hoisted(() => vi.fn());
vi.mock("@/providers/toastBoundary", () => ({
    ToastBoundary: (props: { children: ReactNode }) => {
        boundary(props);
        return <section data-testid="boundary">{props.children}</section>;
    },
}));
describe("ItemListLayoutのProvider境界", () => {
    it("U-L01 同じ子をBoundaryへ渡し包含と順序を保持する", () => {
        const children = (
            <>
                <p>先頭</p>
                <button>末尾</button>
            </>
        );
        render(<ItemListLayout>{children}</ItemListLayout>);
        expect(boundary.mock.calls[0][0].children).toBe(children);
        expect(screen.getByTestId("boundary").textContent).toBe("先頭末尾");
    });
    it("U-L02 nullでもBoundaryを維持して代替表示を追加しない", () => {
        render(<ItemListLayout>{null}</ItemListLayout>);
        expect(boundary.mock.calls[0][0].children).toBeNull();
        expect(screen.getByTestId("boundary")).toBeEmptyDOMElement();
    });
    it("U-L03 再描画で最新の子だけを渡す", () => {
        const { rerender } = render(<ItemListLayout>旧本文</ItemListLayout>);
        rerender(<ItemListLayout>新本文</ItemListLayout>);
        expect(screen.getByTestId("boundary").textContent).toBe("新本文");
        expect(boundary).toHaveBeenLastCalledWith({ children: "新本文" });
    });
});
