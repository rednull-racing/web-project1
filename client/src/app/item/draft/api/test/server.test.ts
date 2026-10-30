import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { fetchItemDraftPage, fetchItemDraftPageMetadata } from "../server";
const apiFetchServer = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/server", () => ({ apiFetchServer }));
beforeEach(() => {
    apiFetchServer.mockReset();
});
describe("下書き専用server API単体", () => {
    it("U-N06 下書きIDをno-storeで共通取得関数へ渡す", async () => {
        const response = { itemDraft: createDraft() };
        apiFetchServer.mockResolvedValue(response);
        expect(await fetchItemDraftPage("11")).toBe(response);
        expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-draft/11/item-page", { cache: "no-store" });
    });
    it("U-N06 共通取得関数の例外を伝播する", async () => {
        const error = new Error("server failure");
        apiFetchServer.mockRejectedValue(error);
        await expect(fetchItemDraftPage("11")).rejects.toBe(error);
    });
});

describe("メタデータ専用server API", () => {
    it.each(["商品名", null, "", "  "])("U-M01 name=%jを専用APIから取得する", async (name) => {
        const response = { itemDraft: { id: 11, name } };
        apiFetchServer.mockResolvedValue(response);
        expect(await fetchItemDraftPageMetadata("11")).toBe(response);
        expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-draft/11/metadata", { cache: "no-store" });
    });
    it("U-M01 取得失敗を同一参照で伝播する", async () => {
        const error = new Error("metadata failure");
        apiFetchServer.mockRejectedValue(error);
        await expect(fetchItemDraftPageMetadata("11")).rejects.toBe(error);
    });
});
