import { screen, waitFor, act } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../../../../fixtures/server";
import { base, deferred, response, row } from "../../../../../fixtures/item-list/draft/fixtures";
import { mount, remove, notifications } from "../../../../../fixtures/item-list/draft/setup";
const target = () => screen.queryByRole("heading", { name: "検証用シャツ101" });
const ready = () => screen.findByRole("heading", { name: "検証用シャツ101" });
describe("削除HTTPとSWRキャッシュ", () => {
    it("C-N03 C-A02 正規DELETE待機中の楽観除去と再GETを反映する", async () => {
        const deletion = deferred<void>(),
            refresh = deferred<void>(),
            started = deferred<void>();
        let gets = 0;
        const requests: { url: string; body: string }[] = [];
        server.use(
            http.get(`${base}/item-draft/list`, async () => {
                if (++gets > 1) {
                    started.resolve();
                    await refresh.promise;
                    return HttpResponse.json({ itemDraftList: [{ itemDraft: row(102) }], totalPages: 1 });
                }
                return HttpResponse.json(response());
            }),
            http.delete(`${base}/item-draft/101`, async ({ request }) => {
                requests.push({ url: request.url, body: await request.text() });
                await deletion.promise;
                return HttpResponse.json({});
            }),
        );
        mount();
        await ready();
        try {
            await remove();
            expect(target()).not.toBeInTheDocument();
            expect(screen.getByRole("heading", { name: "検証用シャツ102" })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
            expect(notifications.success).not.toHaveBeenCalled();
            await waitFor(() => expect(requests).toEqual([{ url: `${base}/item-draft/101`, body: "" }]));
            await act(async () => deletion.resolve());
            await started.promise;
            await waitFor(() =>
                expect(notifications.success).toHaveBeenCalledExactlyOnceWith("下書き商品を削除しました"),
            );
            expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
        } finally {
            await act(async () => {
                deletion.resolve();
                refresh.resolve();
            });
        }
        await waitFor(() => expect(screen.queryByRole("button", { name: "3" })).not.toBeInTheDocument());
        expect(target()).not.toBeInTheDocument();
        expect(notifications.error).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    });
    it.each([401, 404, 500])("C-E01 JSON%s失敗を再GETで復元する", async (status) => {
        const gate = deferred<void>();
        let gets = 0;
        server.use(
            http.get(`${base}/item-draft/list`, () => {
                gets++;
                return HttpResponse.json(response());
            }),
            http.delete(`${base}/item-draft/101`, async () => {
                await gate.promise;
                return HttpResponse.json({ code: "DELETE_FAILED" }, { status });
            }),
        );
        mount();
        await ready();
        try {
            await remove();
            expect(target()).not.toBeInTheDocument();
        } finally {
            await act(async () => gate.resolve());
        }
        await ready();
        expect(gets).toBe(2);
        await waitFor(() =>
            expect(notifications.error).toHaveBeenCalledExactlyOnceWith("下書き商品の削除に失敗しました"),
        );
        expect(notifications.success).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    });
    it.each(["non-json", "network"])("C-E02 %s失敗をalertし再GETする", async (failure) => {
        let gets = 0;
        server.use(
            http.get(`${base}/item-draft/list`, () => {
                gets++;
                return HttpResponse.json(response());
            }),
            http.delete(`${base}/item-draft/101`, () =>
                failure === "network" ? HttpResponse.error() : HttpResponse.text("Too many requests", { status: 429 }),
            ),
        );
        mount();
        await ready();
        await remove();
        await waitFor(() => expect(window.alert).toHaveBeenCalledOnce());
        await ready();
        expect(gets).toBe(2);
        expect(notifications.success).not.toHaveBeenCalled();
        expect(notifications.error).not.toHaveBeenCalled();
    });
    it("C-E02 DELETE成功後の再GET失敗でも成功通知を維持する", async () => {
        let gets = 0;
        const failed = deferred<void>();
        server.use(
            http.get(`${base}/item-draft/list`, () => {
                if (++gets > 1) {
                    failed.resolve();
                    return HttpResponse.json({}, { status: 500 });
                }
                return HttpResponse.json(response());
            }),
            http.delete(`${base}/item-draft/101`, () => HttpResponse.json({})),
        );
        mount();
        await ready();
        await remove();
        await failed.promise;
        await waitFor(() => expect(notifications.success).toHaveBeenCalledOnce());
        expect(target()).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "検証用シャツ102" })).toBeInTheDocument();
        expect(notifications.error).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
    });
});
