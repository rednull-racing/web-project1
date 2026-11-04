import toast from "react-hot-toast";
import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
vi.mock("@/components", () => ({
    Container: ({ children }: { children: ReactNode }) => <main>{children}</main>,
    TitleAndBack: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
import UploadUI from "../uploadUI";
import styles from "@/components/loading/loading.module.css";
import { TopLoader } from "@/components/loading/topLoader";
import UploadLayout from "../layout";

describe("UploadUI/layout", () => {
    it("U16 見出しと子をContainerへ引き渡す", () => {
        render(
            <UploadUI title="商品をアップロード">
                <button>子操作</button>
            </UploadUI>,
        );
        expect(screen.getByRole("main")).toContainElement(screen.getByRole("heading", { name: "商品をアップロード" }));
        expect(screen.getByRole("main")).toContainElement(screen.getByRole("button", { name: "子操作" }));
    });
    it("U16 layoutは通知ホストとchildrenを接続", async () => {
        vi.stubGlobal(
            "matchMedia",
            vi.fn(() => ({
                matches: false,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        );
        render(
            <UploadLayout>
                <p>フォーム本体</p>
            </UploadLayout>,
        );
        expect(screen.getByText("フォーム本体")).toBeInTheDocument();
        act(() => {
            toast.success("登録しました");
        });
        expect(await screen.findByText("登録しました")).toBeInTheDocument();
        act(() => {
            toast.remove();
        });
    });
    it("U16 TopLoaderはloading時のみ表示", () => {
        const { container, rerender } = render(<TopLoader loading={false} />);
        expect(container.firstElementChild).not.toHaveClass(styles.show);
        rerender(<TopLoader loading />);
        expect(container.firstElementChild).toHaveClass(styles.show);
    });
});
