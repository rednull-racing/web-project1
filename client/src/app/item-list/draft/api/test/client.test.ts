import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api/client";
import { fetcher as sharedFetcher } from "@/lib/fetcher";
import { fetcher, fetchRemoveItem, getListUrl } from "../client";
vi.mock("@/lib/api/client", () => ({ apiFetch: vi.fn() }));
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost/api"));
describe("一覧API境界", () => {
    it.each([1, 2].flatMap(page => ["", " ", "　", " シャツ ", " & + # ? / % _ "].map(keyword => ({ page, keyword }))))("U-A01 入力%jをtrimして一度encodeする", ({ page, keyword }) => {
        const suffix = keyword.trim() ? `&keyword=${encodeURIComponent(keyword.trim())}` : "";
        expect(getListUrl(page, keyword)).toBe(`http://localhost/api/item-draft/list?page=${page}${suffix}`);
        expect(fetcher).toBe(sharedFetcher);
    });
    it.each(["http://localhost/api", "http://localhost/api/"].flatMap(base => [0, -1, 1.5].map(page => ({ base, page }))))("U-A02 型内の不正ページとbase末尾%jを補正しない", ({ base, page }) => {
        vi.stubEnv("NEXT_PUBLIC_API_URL", base);
        expect(getListUrl(page, "null")).toBe(`${base}/item-draft/list?page=${page}&keyword=null`);
    });
    it("U-A03 IDで正規DELETEを呼び戻り値を伝播する", async () => {
        const result = { message: "ok" };
        vi.mocked(apiFetch).mockResolvedValue(result);
        expect(await fetchRemoveItem("101")).toBe(result);
        expect(apiFetch).toHaveBeenCalledExactlyOnceWith("/item-draft/101", { method: "DELETE" });
    });
    it("U-A03 依存の同一例外を再試行せず伝播する", async () => {
        const error = new Error("fail");
        vi.mocked(apiFetch).mockRejectedValue(error);
        await expect(fetchRemoveItem("101")).rejects.toBe(error);
        expect(apiFetch).toHaveBeenCalledOnce();
    });
});
