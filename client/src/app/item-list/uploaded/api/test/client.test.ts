import { describe, expect, it, vi } from "vitest";
import { getListUrl } from "../client";
describe("uploaded URL", () => {
    it.each([
        ["all", "?page=2"], ["selling", "?page=2&status=active"], ["sold", "?page=2&status=soldout"],
    ] as const)("U-N01 %s", (tab, query) => {
        vi.stubEnv("NEXT_PUBLIC_API_URL", "http://example.test/api");
        expect(getListUrl(2, " 日本 &% ", tab)).toBe(
            `http://example.test/api/items/list/uploaded${query}&keyword=${encodeURIComponent("日本 &%")}`);
    });
    it("U-V01 空白検索を除外し未指定・不正タブの通信を停止", () => {
        vi.stubEnv("NEXT_PUBLIC_API_URL", "http://example.test/api");
        expect(getListUrl(1, "  ", "all")).toBe("http://example.test/api/items/list/uploaded?page=1");
        expect(getListUrl(1, "")).toBeNull();
        // URLから流入する型外値の防御分岐。
        // @ts-expect-error invalid runtime tab
        expect(getListUrl(1, "", "invalid")).toBeNull();
    });
});
