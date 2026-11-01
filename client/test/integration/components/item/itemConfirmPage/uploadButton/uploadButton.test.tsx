import { API, runtime } from "@/../test/fixtures/item/itemConfirmPage/setup";
import { deferred } from "@/../test/fixtures/item/itemConfirmPage/fixtures";
import { server } from "@/../test/fixtures/server";
import { UploadButton } from "@/app/item/confirm/uploadButton";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

const submit = () => screen.getAllByRole("button", { name: "出品する" }).at(-1)!;
async function openAndAgree() {
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "出品する" }));
    await user.click(screen.getByRole("checkbox", { name: "この商品は利用規約を遵守しております。" }));
    return user;
}
const modes = ["normal", "edit"] as const;
for (const page of modes) {
    const method = page === "normal" ? http.post : http.put;
    const destination = page === "normal" ? "/upload/ok/501" : "/item/501";
    describe(`UploadButton HTTP ${page}`, () => {
        it("C-N01 正しい本文・成功通知と1500ms後の返却IDへの遷移", async () => {
            const reached = vi.fn();
            let startTimer!: () => void;
            runtime.sleep.mockImplementation(
                (ms) =>
                    new Promise((done) => {
                        startTimer = () => {
                            setTimeout(done, ms);
                        };
                    }),
            );
            server.use(
                method(`${API}/items`, async ({ request }) => {
                    reached(await request.json(), request.headers.get("authorization"));
                    return HttpResponse.json({ itemId: 501 });
                }),
            );
            render(<UploadButton id="101" page={page} />);
            const user = await openAndAgree();
            await user.click(submit());
            await waitFor(() =>
                expect(runtime.success).toHaveBeenCalledExactlyOnceWith(
                    page === "normal" ? "商品を出品しました" : "商品情報を更新しました",
                ),
            );
            expect(reached).toHaveBeenCalledExactlyOnceWith({ itemEditingId: 101 }, "Bearer test-access-token");
            // HTTP完了後に待機部分だけ時計を制御する。
            expect(runtime.sleep).toHaveBeenCalledExactlyOnceWith(1500);
            expect(runtime.push).not.toHaveBeenCalled();
            vi.useFakeTimers();
            startTimer();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1499);
            });
            expect(runtime.push).not.toHaveBeenCalled();
            await act(async () => {
                await vi.advanceTimersByTimeAsync(1);
            });
            expect(runtime.push).toHaveBeenCalledExactlyOnceWith(destination);
            vi.useRealTimers();
            expect(runtime.error).not.toHaveBeenCalled();
        });
        it.each([400, 401, 403, 404, 409, 429, 500, "network", "json"] as const)(
            "C-E01 %sで通知し停止、同意を保持して再試行",
            async (status) => {
                let fail = true;
                const reached = vi.fn();
                server.use(
                    method(`${API}/items`, async ({ request }) => {
                        reached(await request.json());
                        if (!fail) return HttpResponse.json({ itemId: 501 });
                        if (status === "network") return HttpResponse.error();
                        if (status === "json") return new HttpResponse("invalid", { status: 500 });
                        return HttpResponse.json({ code: "FAIL" }, { status });
                    }),
                );
                render(<UploadButton id="101" page={page} />);
                const user = await openAndAgree();
                await user.click(submit());
                if (typeof status === "number") await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
                else
                    await waitFor(() =>
                        expect(window.alert).toHaveBeenCalledExactlyOnceWith(
                            "システムエラーが発生しました。時間をおいて再試行してください",
                        ),
                    );
                expect(runtime.success).not.toHaveBeenCalled();
                expect(runtime.sleep).not.toHaveBeenCalled();
                expect(runtime.push).not.toHaveBeenCalled();
                expect(screen.getByRole("checkbox")).toBeChecked();
                fail = false;
                await user.click(submit());
                await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith(destination));
                expect(reached.mock.calls).toEqual([[{ itemEditingId: 101 }], [{ itemEditingId: 101 }]]);
            },
        );
        it("C-O01 応答保留中の連打を止め失敗後に復旧", async () => {
            const gate = deferred<void>();
            const reached = vi.fn();
            server.use(
                method(`${API}/items`, async () => {
                    reached();
                    await gate.promise;
                    return HttpResponse.json({ code: "FAIL" }, { status: 500 });
                }),
            );
            render(<UploadButton id="101" page={page} />);
            const user = await openAndAgree();
            try {
                await user.click(submit());
                await waitFor(() => expect(reached).toHaveBeenCalledTimes(1));
                await user.click(submit());
                expect(reached).toHaveBeenCalledTimes(1);
                expect(submit()).toBeDisabled();
                expect(runtime.push).not.toHaveBeenCalled();
            } finally {
                gate.resolve();
                await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
                expect(submit()).toBeEnabled();
            }
        });
        it("C-O01 成功待機中も再送と編集を止めunmount後に遷移しない", async () => {
            const gate = deferred<void>();
            runtime.sleep.mockReturnValue(gate.promise);
            const reached = vi.fn();
            server.use(
                method(`${API}/items`, () => {
                    reached();
                    return HttpResponse.json({ itemId: 501 });
                }),
            );
            const view = render(<UploadButton id="101" page={page} />);
            const user = await openAndAgree();
            await user.click(submit());
            await waitFor(() => expect(runtime.success).toHaveBeenCalledTimes(1));
            const close = view.container.querySelector("svg");
            expect(close).not.toBeNull();
            await user.click(close!);
            await user.click(screen.getByRole("button", { name: "出品する" }));
            expect(screen.getByRole("checkbox")).toBeChecked();
            expect(screen.getByRole("link", { name: "商品を編集する" })).toHaveAttribute("aria-disabled", "true");
            expect(screen.getByRole("link", { name: "商品を編集する" })).not.toHaveAttribute("href");
            await user.click(submit());
            expect(submit()).toBeDisabled();
            expect(runtime.success).toHaveBeenCalledTimes(1);
            expect(reached).toHaveBeenCalledTimes(1);
            view.unmount();
            await act(async () => gate.resolve());
            expect(runtime.push).not.toHaveBeenCalled();
        });
    });
}
