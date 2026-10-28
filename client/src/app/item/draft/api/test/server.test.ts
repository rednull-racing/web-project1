import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDraft } from "@/../test/fixtures/item/itemDraftPage/fixtures";
import { fetchItemDraftPage } from "../server";
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
        expect(apiFetchServer).toHaveBeenCalledExactlyOnceWith("/item-draft/11", { cache: "no-store" });
    });
    it("U-N06 共通取得関数の例外を伝播する", async () => {
        const error = new Error("server failure");
        apiFetchServer.mockRejectedValue(error);
        await expect(fetchItemDraftPage("11")).rejects.toBe(error);
    });
});
