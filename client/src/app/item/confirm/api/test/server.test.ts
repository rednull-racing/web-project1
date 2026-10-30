// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
import { createEditing } from "../../test/fixtures";
import { fetchItemConfirmPage, fetchItemConfirmPageMetadata } from "../server";
const apiFetchServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server", () => ({ apiFetchServer }));
beforeEach(() => { apiFetchServer.mockReset(); });
it("U-A02 詳細取得は専用URLとno-storeで同一参照を返す", async () => {
    const response = { itemEditing: createEditing() };
    apiFetchServer.mockResolvedValue(response);
    expect(await fetchItemConfirmPage("101")).toBe(response);
    expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-editing/101/confirm", { cache: "no-store" });
});
it.each(["商品名", null, "", "  "])("U-A02 metadata name=%jを保持", async name => {
    const response = { itemEditing: { id: 101, name } };
    apiFetchServer.mockResolvedValue(response);
    expect(await fetchItemConfirmPageMetadata("101")).toBe(response);
    expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-editing/101/metadata", { cache: "no-store" });
});
it.each([fetchItemConfirmPage, fetchItemConfirmPageMetadata])("U-A03 %sの例外伝播", async request => {
    const error = new Error("server failure");
    apiFetchServer.mockRejectedValue(error);
    await expect(request("101")).rejects.toBe(error);
    expect(apiFetchServer).toHaveBeenCalledOnce();
});
