import { expect, it, vi } from "vitest";
import { getListUrl } from "../client";
it.each([[1, "", "?page=1"], [2, "  ", "?page=2"], [3, " 日本 &% ", `?page=3&keyword=${encodeURIComponent("日本 &%")}`]])(
    "U-N01 page=%s keyword=%s", (page, keyword, query) => {
        vi.stubEnv("NEXT_PUBLIC_API_URL", "http://example.test/api");
        expect(getListUrl(Number(page), keyword)).toBe(`http://example.test/api/items/list/stock${query}`);
    });
