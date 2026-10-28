import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/apiError";
import { deferred } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { DeleteItemDraft } from "../delete";

const mocks = vi.hoisted(() => ({ push: vi.fn(), request: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../api/client", () => ({ fetchDeleteDraftItem: mocks.request }));
vi.mock("react-hot-toast", () => ({ default: { success: mocks.success, error: mocks.error } }));

beforeEach(() => { mocks.request.mockReset(); });
describe("DeleteItemDraft 単体", () => {
    it.each(["背景", "X"])("U-N03 確認を%sで閉じて再度開ける、キャンセルでは通信しない", async (close) => {
        const user = userEvent.setup();
        const { container } = render(<DeleteItemDraft id="11" />);
        expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
        await user.click(screen.getByText("この下書き商品を削除する"));
        expect(screen.getByText("※ 本当にこの下書き商品を削除しますか？")).toBeInTheDocument();
        const target = close === "X" ? container.querySelector("svg") : container.querySelector("div");
        expect(target).not.toBeNull();
        await user.click(target!);
        expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
        await user.click(screen.getByText("この下書き商品を削除する"));
        expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
        expect(mocks.request).not.toHaveBeenCalled();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.error).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
    });
    it("U-N04 応答前は成功通知せず、成功後1500msで一度だけ遷移する", async () => {
        const user = userEvent.setup();
        const pending = deferred<unknown>();
        mocks.request.mockReturnValue(pending.promise);
        render(<DeleteItemDraft id="11" />);
        await user.click(screen.getByText("この下書き商品を削除する"));
        await user.click(screen.getByRole("button", { name: "削除する" }));
        expect(mocks.request).toHaveBeenCalledExactlyOnceWith("11");
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
        vi.useFakeTimers();
        await act(async () => pending.resolve({ message: "ok" }));
        expect(mocks.success).toHaveBeenCalledExactlyOnceWith("下書き商品を削除しました");
        expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
        await act(async () => vi.advanceTimersByTimeAsync(1499));
        expect(mocks.push).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/my-page");
    });
    it.each([new ApiError("NOT_FOUND"), new Error("network")])("U-F02 %s を区別して通知し、失敗では遷移しない", async (error) => {
        const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
        const user = userEvent.setup();
        const retry = deferred<unknown>();
        mocks.request.mockRejectedValueOnce(error).mockReturnValueOnce(retry.promise);
        render(<DeleteItemDraft id="11" />);
        await user.click(screen.getByText("この下書き商品を削除する"));
        await user.click(screen.getByRole("button", { name: "削除する" }));
        expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
        if (error instanceof ApiError) {
            expect(mocks.error).toHaveBeenCalledExactlyOnceWith("下書き商品の削除に失敗しました");
            expect(alert).not.toHaveBeenCalled();
        } else {
            expect(alert).toHaveBeenCalledExactlyOnceWith("システムエラーが発生しました。時間をおいて再試行してください");
            expect(mocks.error).not.toHaveBeenCalled();
        }
        vi.useFakeTimers();
        await act(async () => vi.advanceTimersByTimeAsync(2000));
        vi.useRealTimers();
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
        await user.click(screen.getByText("この下書き商品を削除する"));
        await user.click(screen.getByRole("button", { name: "削除する" }));
        expect(mocks.request).toHaveBeenCalledTimes(2);
        expect(mocks.request).toHaveBeenNthCalledWith(2, "11");
        expect(mocks.success).not.toHaveBeenCalled();
        expect(mocks.push).not.toHaveBeenCalled();
        vi.useFakeTimers();
        await act(async () => retry.resolve({ message: "ok" }));
        expect(mocks.success).toHaveBeenCalledExactlyOnceWith("下書き商品を削除しました");
        expect(screen.queryByRole("button", { name: "削除する" })).not.toBeInTheDocument();
        await act(async () => vi.advanceTimersByTimeAsync(1499));
        expect(mocks.push).not.toHaveBeenCalled();
        await act(async () => vi.advanceTimersByTimeAsync(1));
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/my-page");
    });
});
