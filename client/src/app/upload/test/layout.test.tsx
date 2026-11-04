import { act, render, screen } from "@testing-library/react";
import toast from "react-hot-toast";
import { afterEach, expect, it, vi } from "vitest";
import UploadLayout from "../layout";

afterEach(() => { toast.remove(); });
it("U16 layoutの実ToastBoundaryがchildrenと成功通知を描画", async () => {
    vi.stubGlobal("matchMedia", vi.fn((query: string): MediaQueryList => ({
        matches: false, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(),
        addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(() => true),
    })));
    render(<UploadLayout><p>フォーム領域</p></UploadLayout>);
    expect(screen.getByText("フォーム領域")).toBeInTheDocument();
    act(() => { toast.success("商品データを登録しました"); });
    expect(await screen.findByText("商品データを登録しました")).toBeInTheDocument();
});
