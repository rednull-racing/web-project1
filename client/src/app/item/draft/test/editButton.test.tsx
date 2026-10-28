import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/apiError";
import { deferred } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { EditButton } from "../editButton";

const mocks = vi.hoisted(() => ({ push: vi.fn(), request: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("../api/client", () => ({ fetchEditDraftItem: mocks.request }));
vi.mock("react-hot-toast", () => ({ default: { error: mocks.error } }));

beforeEach(() => { mocks.request.mockReset(); });
describe("EditButton 単体", () => {
    it("U-N02 通信中の再クリックを止め、成功レスポンスの編集IDへ一度だけ遷移する", async () => {
        const pending = deferred<{ itemEditingId: number }>();
        mocks.request.mockReturnValue(pending.promise);
        const user = userEvent.setup();
        render(<EditButton id="11" />);
        const button = screen.getByRole("button", { name: "編集する" });
        expect(button).toBeEnabled();
        await user.click(button);
        expect(button).toBeDisabled();
        await user.click(button);
        expect(mocks.request).toHaveBeenCalledExactlyOnceWith("11");
        expect(mocks.push).not.toHaveBeenCalled();
        await act(async () => pending.resolve({ itemEditingId: 456 }));
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/upload/456");
        expect(mocks.error).not.toHaveBeenCalled();
    });
    it.each([new ApiError("NOT_FOUND"), new Error("network")])("U-F01 %s で通知して操作を復旧し、再試行できる", async (error) => {
        mocks.request.mockRejectedValueOnce(error).mockResolvedValueOnce({ itemEditingId: 456 });
        const user = userEvent.setup();
        render(<EditButton id="11" />);
        const button = screen.getByRole("button", { name: "編集する" });
        await user.click(button);
        await waitFor(() => expect(button).toBeEnabled());
        expect(mocks.error).toHaveBeenCalledExactlyOnceWith("下書きの編集を開始できませんでした。時間を置いて再試行してください");
        expect(mocks.push).not.toHaveBeenCalled();
        await user.click(button);
        expect(mocks.request).toHaveBeenCalledTimes(2);
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/upload/456");
    });
});
