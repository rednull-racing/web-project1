// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetch } from "../client";
import { ApiError } from "../apiError";
const token = vi.hoisted(() => vi.fn());
vi.mock("@/lib/getAccessToken", () => ({ getAccessToken: token }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { token.mockReset().mockResolvedValue("test-token"); fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); vi.stubEnv("NEXT_PUBLIC_API_URL", "http://confirm-api.test"); });
it("U-A04 認証ヘッダー・JSON・オプションを維持", async () => {
    fetchMock.mockResolvedValue(Response.json({ itemId: 501 }));
    expect(await apiFetch("/items", { method: "POST", body: '{"itemEditingId":101}' })).toEqual({ itemId: 501 });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://confirm-api.test/items", { method: "POST", body: '{"itemEditingId":101}', headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" } });
});
it("U-A04 トークンなしは通信前停止", async () => { token.mockResolvedValue(null); await expect(apiFetch("/items")).rejects.toMatchObject({ code: "UNAUTHORIZED" }); expect(fetchMock).not.toHaveBeenCalled(); });
it.each(["DENIED", undefined])("U-A04 非2xx code=%sはApiError", async code => {
    fetchMock.mockResolvedValue(Response.json({ code }, { status: 403 })); const error = await apiFetch("/items").catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError); expect(error).toMatchObject({ code: code ?? "API Error" });
});
it("U-A04 通信失敗は同一例外を伝播", async () => { const error = new TypeError("network"); fetchMock.mockRejectedValue(error); await expect(apiFetch("/items")).rejects.toBe(error); });
it.each([200,500])("U-A04 HTTP%s非JSONはJSON例外として伝播（現行parse順序）", async status => { fetchMock.mockResolvedValue(new Response("bad json", { status })); await expect(apiFetch("/items")).rejects.toBeInstanceOf(SyntaxError); });
