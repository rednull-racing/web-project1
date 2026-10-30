// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { fetchCreateItem, fetchEditItem } from "../client";
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));
beforeEach(() => { apiFetch.mockReset(); });
const requests = [["POST", fetchCreateItem], ["PUT", fetchEditItem]] as const;
it.each(requests)("U-A01 %sは数値JSONを送り返却商品IDを維持", async (method, request) => {
    const response = { itemId: 501 };
    apiFetch.mockResolvedValue(response);
    expect(await request("101")).toBe(response);
    expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/items", { method, body: '{"itemEditingId":101}' });
});
it.each(requests)("U-A03 %sの例外伝播", async (_, request) => {
    const error = new Error("request failure");
    apiFetch.mockRejectedValue(error);
    await expect(request("101")).rejects.toBe(error);
    expect(apiFetch).toHaveBeenCalledOnce();
});
for (const [method, request] of requests) {
    it.each([[" 101 ",101],["",0],["不正",null],["0",0],["-1",-1],["1.5",1.5],["9007199254740993",9007199254740992]])("U-O01 " + method + " id=%jの数値変換観測", async (id, value) => {
        apiFetch.mockResolvedValue({ itemId: 501 });
        await request(String(id));
        expect(apiFetch).toHaveBeenCalledWith("/items", { method, body: JSON.stringify({ itemEditingId: value }) });
    });
}
