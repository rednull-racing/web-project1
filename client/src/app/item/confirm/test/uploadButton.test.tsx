import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/apiError";
import { UploadButton } from "../uploadButton";
const mocks = vi.hoisted(() => ({ create: vi.fn(), edit: vi.fn(), push: vi.fn(), success: vi.fn(), error: vi.fn(), sleep: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../api/client", () => ({ fetchCreateItem: mocks.create, fetchEditItem: mocks.edit }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success, error: mocks.error } }));
vi.mock("@/lib/sleep", () => ({ sleep: mocks.sleep }));
vi.mock("@/components/terms", () => ({ TermsList: ({ number, text }: { number: number; text: string }) => <p data-testid="term">{number}. {text}</p> }));
beforeEach(() => {
    mocks.create.mockReset().mockResolvedValue({ itemId: 501 }); mocks.edit.mockReset().mockResolvedValue({ itemId: 501 });
    mocks.sleep.mockReset().mockResolvedValue(undefined);
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
});
const open = async (page: "normal" | "edit") => {
    const user = userEvent.setup(); const view = render(<UploadButton id="101" page={page} />);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "商品を編集する" })).toHaveAttribute("href", "/upload/edit/101");
    await user.click(screen.getByRole("button", { name: "出品する" })); return { user, ...view };
};
it.each(["normal", "edit"] as const)("U-N05 %sの開閉・禁止事項・未同意・同意保持", async page => {
    const { user, container } = await open(page);
    expect(screen.getAllByTestId("term")).toHaveLength(42);
    expect(screen.getByText("動画・画像禁止事項")).toBeInTheDocument(); expect(screen.getByText("商品禁止事項")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "出品する" })[1]);
    expect(window.alert).toHaveBeenCalledExactlyOnceWith("利用規約に同意し、チェックしてください");
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.edit).not.toHaveBeenCalled();
    await user.click(screen.getByRole("checkbox")); expect(screen.getByRole("checkbox")).toBeChecked();
    // Xと背景にはアクセシブル名がないため現行のDOMイベント接続だけを検証する。
    const close = container.querySelector("svg"); expect(close).not.toBeNull(); fireEvent.click(close!);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "出品する" })); expect(screen.getByRole("checkbox")).toBeChecked();
    const popup = screen.getByRole("checkbox").closest("label")?.parentElement;
    expect(popup?.previousElementSibling).not.toBeNull(); fireEvent.click(popup!.previousElementSibling!);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "出品する" })); expect(screen.getByRole("checkbox")).toBeChecked();
    await user.click(screen.getByRole("checkbox")); expect(screen.getByRole("checkbox")).not.toBeChecked();
});
for (const page of ["normal", "edit"] as const) {
    it.each([new ApiError("SERVER_ERROR"), new Error("network")])("U-E01 " + page + " %sで通知・後続停止・再試行", async error => {
        const request = page === "normal" ? mocks.create : mocks.edit;
        request.mockRejectedValueOnce(error).mockResolvedValueOnce({ itemId: 501 });
        const { user } = await open(page); await user.click(screen.getByRole("checkbox"));
        await user.click(screen.getAllByRole("button", { name: "出品する" })[1]);
        await waitFor(() => expect(request).toHaveBeenCalledExactlyOnceWith("101"));
        if (error instanceof ApiError) {
            expect(mocks.error).toHaveBeenCalledExactlyOnceWith("サーバーエラーが発生しました。通信状況を確認し、もう一度ボタンをクリックしてください"); expect(window.alert).not.toHaveBeenCalled();
        } else {
            expect(window.alert).toHaveBeenCalledExactlyOnceWith("システムエラーが発生しました。時間をおいて再試行してください"); expect(mocks.error).not.toHaveBeenCalled();
        }
        expect(mocks.success).not.toHaveBeenCalled(); expect(mocks.sleep).not.toHaveBeenCalled(); expect(mocks.push).not.toHaveBeenCalled();
        expect(screen.getByRole("checkbox")).toBeChecked(); await user.click(screen.getAllByRole("button", { name: "出品する" })[1]);
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(page === "normal" ? "/upload/ok/501" : "/item/501"));
        expect(request).toHaveBeenCalledTimes(2); expect(page === "normal" ? mocks.edit : mocks.create).not.toHaveBeenCalled();
    });
    it("U-N05 " + page + "成功通知後に待機し返却商品IDへ遷移", async () => {
        let release!: () => void; mocks.sleep.mockImplementation(() => new Promise<void>(resolve => { release = resolve; }));
        const { user } = await open(page); await user.click(screen.getByRole("checkbox")); await user.click(screen.getAllByRole("button", { name: "出品する" })[1]);
        expect(mocks.success).toHaveBeenCalledExactlyOnceWith(page === "normal" ? "商品を出品しました" : "商品情報を更新しました");
        expect(mocks.sleep).toHaveBeenCalledExactlyOnceWith(1500); expect(mocks.push).not.toHaveBeenCalled();
        await act(async () => release()); expect(mocks.push).toHaveBeenCalledExactlyOnceWith(page === "normal" ? "/upload/ok/501" : "/item/501");
    });
}
