import userEvent from "@testing-library/user-event";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/api/apiError";
import { RemoveFloat } from "../removeFloat";
import { fetchRemoveItem } from "../api/client";
import styles from "../removeFloat.module.css";
vi.mock("../api/client", () => ({ fetchRemoveItem: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));
const setup = () => {
    const user = userEvent.setup();
    const mutate = vi.fn<ComponentProps<typeof RemoveFloat>["mutate"]>().mockResolvedValue(undefined);
    const s = render(
        <RemoveFloat itemDraftId="101" mutate={mutate as unknown as ComponentProps<typeof RemoveFloat>["mutate"]} />,
    );
    const icon = s.container.querySelector("svg");
    if (!icon) throw Error("icon");
    return { ...s, mutate, user, open: () => user.click(icon) };
};
const updater = (s: ReturnType<typeof setup>) => {
    const fn = s.mutate.mock.calls[0][0];
    if (typeof fn !== "function") throw Error("updater");
    return fn;
};
beforeEach(() => {
    vi.mocked(fetchRemoveItem).mockResolvedValue({});
    vi.spyOn(window, "alert").mockImplementation(() => {});
});
describe("削除", () => {
    it("U-D01 メニュー開閉とoverlayは通信しない", async () => {
        const s = setup();
        expect(screen.queryByText("下書きから削除")).not.toBeInTheDocument();
        await s.open();
        expect(screen.getByText("下書きから削除")).toBeInTheDocument();
        await s.open();
        expect(screen.queryByText("下書きから削除")).not.toBeInTheDocument();
        await s.open();
        const o = s.container.querySelector(`.${styles.overlay}`);
        if (!o) throw Error("overlay");
        await s.user.click(o);
        expect(screen.queryByText("下書きから削除")).not.toBeInTheDocument();
        expect(s.mutate).not.toHaveBeenCalled();
        expect(fetchRemoveItem).not.toHaveBeenCalled();
        expect(toast.success).not.toHaveBeenCalled();
    });
    it("U-D02 楽観更新後に成功通知する", async () => {
        let resolve!: () => void;
        vi.mocked(fetchRemoveItem).mockReturnValue(
            new Promise<void>((r) => {
                resolve = r;
            }),
        );
        const s = setup();
        await s.open();
        await s.user.click(screen.getByText("下書きから削除"));
        expect(fetchRemoveItem).toHaveBeenCalledExactlyOnceWith("101");
        expect(s.mutate.mock.calls[0][1]).toBe(false);
        const row = (id: string) => ({
            id,
            name: "x",
            title: "v",
            price: 1,
            first_image_url: "",
            createdAt: new Date(),
        });
        const current = { itemDraftList: [row("101"), row("102")], totalPages: 3 };
        const result = await updater(s)(current);
        expect(result).toEqual({ ...current, itemDraftList: [current.itemDraftList[1]] });
        expect(current.itemDraftList).toHaveLength(2);
        expect(toast.success).not.toHaveBeenCalled();
        await act(async () => resolve());
        expect(s.mutate.mock.calls[1]).toEqual([]);
        expect(toast.success).toHaveBeenCalledWith("下書き商品を削除しました");
        expect(toast.error).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    });
    it.each(["undefined", "empty", "missing"])("U-D03 cache %sの保持", async (kind) => {
        const s = setup();
        await s.open();
        await s.user.click(screen.getByText("下書きから削除"));
        const current =
            kind === "undefined"
                ? undefined
                : {
                      itemDraftList:
                          kind === "empty"
                              ? []
                              : [
                                    {
                                        id: "102",
                                        name: "x",
                                        title: "v",
                                        price: 1,
                                        first_image_url: "",
                                        createdAt: new Date(),
                                    },
                                ],
                      totalPages: 3,
                  };
        expect(await updater(s)(current)).toEqual(current);
        await waitFor(() => expect(toast.success).toHaveBeenCalled());
    });
    it.each(["api", "normal"])("U-D04 %s失敗の再検証と通知", async (kind) => {
        vi.mocked(fetchRemoveItem).mockRejectedValue(kind === "api" ? new ApiError("FAIL") : new Error("FAIL"));
        const s = setup();
        await s.open();
        await s.user.click(screen.getByText("下書きから削除"));
        await waitFor(() => expect(s.mutate).toHaveBeenCalledTimes(2));
        expect(s.mutate.mock.calls[1]).toEqual([]);
        expect(toast.success).not.toHaveBeenCalled();
        if (kind === "api") {
            expect(toast.error).toHaveBeenCalledWith("下書き商品の削除に失敗しました");
            expect(window.alert).not.toHaveBeenCalled();
        } else {
            expect(window.alert).toHaveBeenCalledWith("システムエラーが発生しました。時間をおいて再試行してください");
            expect(toast.error).not.toHaveBeenCalled();
        }
    });
    it("U-X01 数値ID不一致と重複操作を観測", async () => {
        let resolve!: () => void;
        const p = new Promise<void>((r) => {
            resolve = r;
        });
        vi.mocked(fetchRemoveItem).mockReturnValue(p);
        const s = setup();
        await s.open();
        await s.user.click(screen.getByText("下書きから削除"));
        await s.user.click(screen.getByText("下書きから削除"));
        const current = { itemDraftList: [{ id: 101 }], totalPages: 1 };
        expect(await updater(s)(current as unknown as Parameters<ReturnType<typeof updater>>[0])).toEqual(current);
        expect(fetchRemoveItem).toHaveBeenCalledTimes(2);
        await act(async () => resolve());
        expect(toast.success).toHaveBeenCalledTimes(2);
    });
});
