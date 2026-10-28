import { API, runtime } from "@/../test/fixtures/item/itemDraftPage/setup";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { EditButton } from "@/app/item/draft/editButton";
import { server } from "@/../test/fixtures/server";
import { deferred } from "@/../test/fixtures/item/itemDraftPage/fixtures";

describe("EditButton HTTP integration", () => {
    it("C-N01: 認証付きPOSTを1回だけ送信し201後に返却編集IDへ遷移", async () => {
        const gate = deferred<void>();
        const received = vi.fn();
        server.use(http.post(`${API}/item-editing/draft`, async ({ request }) => {
            received({ body: await request.json(), auth: request.headers.get("Authorization"), contentType: request.headers.get("Content-Type") });
            await gate.promise;
            return HttpResponse.json({ itemEditingId: 456 }, { status: 201 });
        }));
        render(<EditButton id="11" />);
        const user = userEvent.setup();
        await user.click(screen.getByRole("button", { name: "編集する" }));
        try {
            await waitFor(() => expect(received).toHaveBeenCalledTimes(1));
            expect(received).toHaveBeenCalledWith({ body: { itemDraftId: 11 }, auth: "Bearer test-access-token", contentType: "application/json" });
            expect(screen.getByRole("button")).toBeDisabled();
            await user.click(screen.getByRole("button"));
            expect(received).toHaveBeenCalledTimes(1);
            expect(runtime.push).not.toHaveBeenCalled();
        } finally { await act(async () => gate.resolve()); }
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/upload/456"));
    });

    it.each([400, 401, 404, 429, 500, "network", "json"] as const)("C-F01: %s失敗後に再試行可能で成功遷移しない", async (failure) => {
        server.use(http.post(`${API}/item-editing/draft`, () => typeof failure === "number"
            ? HttpResponse.json({ code: "TEST_ERROR" }, { status: failure })
            : failure === "network" ? HttpResponse.error() : new HttpResponse("not JSON")));
        const user = userEvent.setup(); render(<EditButton id="11" />);
        await user.click(screen.getByRole("button"));
        await waitFor(() => expect(runtime.error).toHaveBeenCalledExactlyOnceWith("下書きの編集を開始できませんでした。時間を置いて再試行してください"));
        expect(runtime.push).not.toHaveBeenCalled(); expect(screen.getByRole("button")).toBeEnabled();
        server.use(http.post(`${API}/item-editing/draft`, () => HttpResponse.json({ itemEditingId: 456 }, { status: 201 })));
        await user.click(screen.getByRole("button"));
        await waitFor(() => expect(runtime.push).toHaveBeenCalledExactlyOnceWith("/upload/456"));
    });

    it("C-F03: トークンなしなら業務HTTP未送信", async () => {
        runtime.token.mockResolvedValue(null);
        const reached = vi.fn();
        server.use(http.post(`${API}/item-editing/draft`, () => { reached(); return HttpResponse.json({}); }));
        render(<EditButton id="11" />);
        await userEvent.setup().click(screen.getByRole("button"));
        await waitFor(() => expect(runtime.error).toHaveBeenCalledTimes(1));
        expect(reached).not.toHaveBeenCalled(); expect(runtime.push).not.toHaveBeenCalled();
    });
});
