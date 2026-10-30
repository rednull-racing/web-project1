// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { apiFetchServer } from "../server";
const mocks = vi.hoisted(() => ({ token: vi.fn(), valid: vi.fn(), redirect: vi.fn((url: string) => { throw new Error("redirect:" + url); }), notFound: vi.fn(() => { throw new Error("notFound"); }) }));
vi.mock("next-auth/jwt", () => ({ getToken: mocks.token }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [{ name: "session", value: "fixture" }] }), headers: async () => new Headers({ host: "test" }) }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock("@/lib/refreshToken", () => ({ getValidAccessToken: mocks.valid }));
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
    mocks.token.mockReset().mockResolvedValue({ sub: "7" }); mocks.valid.mockReset().mockResolvedValue("test-token"); fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock); vi.stubEnv("API_URL", "http://confirm-server.test"); vi.spyOn(console, "error").mockImplementation(() => undefined);
});
it("U-A05 JWTなしは通信前login", async () => { mocks.token.mockResolvedValue(null); await expect(apiFetchServer("/item-editing/101/confirm")).rejects.toThrow("redirect:/login"); expect(mocks.valid).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled(); });
it("U-A05 有効トークンなしは通信前login", async () => { mocks.valid.mockResolvedValue(null); await expect(apiFetchServer("/item-editing/101/confirm")).rejects.toThrow("redirect:/login"); expect(fetchMock).not.toHaveBeenCalled(); });
it("U-A05 GET認証ヘッダー・no-store・結果", async () => {
    fetchMock.mockResolvedValue(Response.json({ itemEditing: { id: 101 } }));
    expect(await apiFetchServer("/item-editing/101/confirm", { cache: "no-store" })).toEqual({ itemEditing: { id: 101 } });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("http://confirm-server.test/item-editing/101/confirm", { cache: "no-store", method: "GET", headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" } });
});
it.each([[401,"redirect:/login"],[404,"notFound"],[500,"BROKEN"]])("U-A05 HTTP%sは%sで後続停止", async (status, message) => {
    fetchMock.mockResolvedValue(Response.json({ code: "BROKEN" }, { status: Number(status) })); await expect(apiFetchServer("/item-editing/101/confirm")).rejects.toThrow(String(message)); expect(fetchMock).toHaveBeenCalledOnce();
});
it("U-A05 codeなし500はSERVER_ERROR", async () => { fetchMock.mockResolvedValue(Response.json({}, { status: 500 })); await expect(apiFetchServer("/item-editing/101/confirm")).rejects.toThrow("SERVER_ERROR"); });
it.each([200,500])("U-A05 HTTP%s非JSON失敗を握り潰さない", async status => { fetchMock.mockResolvedValue(new Response("invalid json", { status })); await expect(apiFetchServer("/item-editing/101/confirm")).rejects.toBeInstanceOf(SyntaxError); });
