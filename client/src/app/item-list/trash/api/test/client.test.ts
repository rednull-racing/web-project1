import { beforeEach, describe, it, expect, vi } from "vitest";
import { fetcher as sharedFetcher } from "@/lib/fetcher";
import { fetcher, getListUrl } from "../client";
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_API_URL", "http://localhost/api"));
describe("削除一覧URL", () => {
    it.each(
        [1, 2].flatMap((page) => ["", " ", "　", " シャツ ", " & + # ? / % _ "].map((keyword) => ({ page, keyword }))),
    )("U-A01 入力%jのtrimとencode", ({ page, keyword }) => {
        const suffix = keyword.trim() ? `&keyword=${encodeURIComponent(keyword.trim())}` : "";
        expect(getListUrl(page, keyword)).toBe(`http://localhost/api/item-trash/list?page=${page}${suffix}`);
    });
    it.each(
        ["http://localhost/api", "http://localhost/api/"].flatMap((base) =>
            [0, -1, 1.5].map((page) => ({ base, page })),
        ),
    )("U-A02 %jを補正せず共通fetcherを再export", ({ base, page }) => {
        vi.stubEnv("NEXT_PUBLIC_API_URL", base);
        expect(getListUrl(page, "null")).toBe(`${base}/item-trash/list?page=${page}&keyword=null`);
        expect(fetcher).toBe(sharedFetcher);
    });
});
