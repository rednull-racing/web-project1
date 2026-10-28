import { API, runtime } from "@/../test/fixtures/item/itemDraftPage/setup";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { DeleteItemDraft } from "@/app/item/draft/delete";
import { server } from "@/../test/fixtures/server";
import { deferred } from "@/../test/fixtures/item/itemDraftPage/fixtures";

const open = () => userEvent.setup().click(screen.getByText("この下書き商品を削除する"));
const submit = () => screen.getByRole("button", { name: "削除する" });

describe("DeleteItemDraft HTTP integration", () => {
    it("C-N02: キャンセル時送信なし、成功応答後に確認を閉じ遷移を待つ", async () => {
        const gate = deferred<void>();
        const sleep = deferred<void>();
        runtime.sleep.mockReturnValue(sleep.promise);
        const reached = vi.fn();
        server.use(
            http.delete(`${API}/item-draft/11`, async ({ request }) => {
                reached({ body: await request.text(), auth: request.headers.get("Authorization") });
                await gate.promise;
                return HttpResponse.json({ message: "下書き商品を削除しました" });
            }),
        );
        const { container } = render(<DeleteItemDraft id="11" />);
        await open();
        fireEvent.click(container.querySelector("svg")!);
        expect(reached).not.toHaveBeenCalled();
        expect(screen.queryByText("確認")).not.toBeInTheDocument();
        await open();
        await userEvent.setup().click(submit());
        try {
            await waitFor(() =>
                expect(reached).toHaveBeenCalledExactlyOnceWith({ body: "", auth: "Bearer test-access-token" }),
            );
            expect(runtime.success).not.toHaveBeenCalled();
            expect(runtime.push).not.toHaveBeenCalled();
        } finally {
            await act(async () => gate.resolve());
        }
        await waitFor(() => expect(runtime.success).toHaveBeenCalledExactlyOnceWith("下書き商品を削除しました"));
        expect(screen.queryByText("確認")).not.toBeInTheDocument();
        expect(runtime.push).not.toHaveBeenCalled();
        expect(runtime.sleep).toHaveBeenCalledExactlyOnceWith(1500);
        await act(async () => sleep.resolve());
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/my-page"));
    });

    it.each([400, 401, 404, 429, 500, "network", "json"] as const)(
        "C-F02: %s失敗を通知して後続停止、再試行可能",
        async (failure) => {
            server.use(
                http.delete(`${API}/item-draft/11`, () =>
                    typeof failure === "number"
                        ? HttpResponse.json({ code: "TEST_ERROR" }, { status: failure })
                        : failure === "network"
                          ? HttpResponse.error()
                          : new HttpResponse("not JSON"),
                ),
            );
            render(<DeleteItemDraft id="11" />);
            await open();
            await userEvent.setup().click(submit());
            await waitFor(() => expect(screen.queryByText("確認")).not.toBeInTheDocument());
            if (typeof failure === "number") {
                expect(runtime.error).toHaveBeenCalledExactlyOnceWith("下書き商品の削除に失敗しました");
                expect(window.alert).not.toHaveBeenCalled();
            } else {
                expect(window.alert).toHaveBeenCalledExactlyOnceWith(
                    "システムエラーが発生しました。時間をおいて再試行してください",
                );
                expect(runtime.error).not.toHaveBeenCalled();
            }
            expect(runtime.push).not.toHaveBeenCalled();
            expect(runtime.success).not.toHaveBeenCalled();
            expect(runtime.sleep).not.toHaveBeenCalled();
            server.use(http.delete(`${API}/item-draft/11`, () => HttpResponse.json({ message: "deleted" })));
            await open();
            await userEvent.setup().click(submit());
            await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/my-page"));
        },
    );

    it("C-F03: トークンなしならDELETEなし", async () => {
        runtime.token.mockResolvedValue(null);
        const reached = vi.fn();
        server.use(
            http.delete(`${API}/item-draft/11`, () => {
                reached();
                return HttpResponse.json({});
            }),
        );
        render(<DeleteItemDraft id="11" />);
        await open();
        await userEvent.setup().click(submit());
        await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
        expect(reached).not.toHaveBeenCalled();
        expect(runtime.push).not.toHaveBeenCalled();
        expect(runtime.success).not.toHaveBeenCalled();
    });

    it.each(["click", "keyboard"])("Q01: 保留中の削除を%sで繰り返してもDELETEは1回", async (method) => {
        const gate = deferred<void>();
        const reached = vi.fn();
        server.use(
            http.delete(`${API}/item-draft/11`, async () => {
                reached();
                await gate.promise;
                return HttpResponse.json({ code: "TEST_END" }, { status: 500 });
            }),
        );
        const user = userEvent.setup();
        render(<DeleteItemDraft id="11" />);
        await open();
        await user.click(submit());
        try {
            await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
            if (method === "click") await user.dblClick(submit());
            else {
                submit().focus();
                await user.keyboard("{Enter}{Enter}");
            }
            await act(async () => undefined);
            expect(reached).toHaveBeenCalledTimes(1);
            expect(submit()).toBeDisabled();
        } finally {
            await act(async () => gate.resolve());
            await waitFor(() => expect(screen.queryByText("確認")).not.toBeInTheDocument());
        }
    });
});
