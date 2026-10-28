import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDeleteDraftItem, fetchEditDraftItem } from "../client";
const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/client", () => ({ apiFetch }));
beforeEach(() => {
    apiFetch.mockReset();
});
describe("下書き専用client API単体", () => {
    it("U-N05 編集開始は数値JSON・POSTで返却値をそのまま返す", async () => {
        const response = { itemEditingId: 456 };
        apiFetch.mockResolvedValue(response);
        expect(await fetchEditDraftItem("11")).toBe(response);
        expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/item-editing/draft", {
            method: "POST",
            body: '{"itemDraftId":11}',
        });
    });
    it("U-N05 削除は下書きIDのDELETEでbodyを付けない", async () => {
        const response = { message: "下書き商品を削除しました" };
        apiFetch.mockResolvedValue(response);
        expect(await fetchDeleteDraftItem("11")).toBe(response);
        expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/item-draft/11", { method: "DELETE" });
    });
    it.each([fetchEditDraftItem, fetchDeleteDraftItem])("U-N05 API例外を握りつぶさず伝播する %s", async (request) => {
        const error = new Error("failure");
        apiFetch.mockRejectedValue(error);
        await expect(request("11")).rejects.toBe(error);
    });
    it.each([
        ["0011", 11],
        ["不正", null],
    ])("U-V04 編集ID%sはJSON上の%sへ変換する", async (id, value) => {
        apiFetch.mockResolvedValue({ itemEditingId: 456 });
        await fetchEditDraftItem(String(id));
        expect(apiFetch).toHaveBeenCalledWith("/item-editing/draft", {
            method: "POST",
            body: JSON.stringify({ itemDraftId: value }),
        });
    });
});
