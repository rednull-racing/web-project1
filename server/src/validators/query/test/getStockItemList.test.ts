import { describe, expect, it } from "vitest";
import { getStockItemListQuerySchema as schema } from "../items.js";

describe("P0 一覧query", () => {
    it.each([undefined, "1", "10000", "1e2"])("V01: page=%sを変換", (page) => {
        expect(schema.parse({ page })).toEqual({ page: page === undefined ? 1 : Number(page), keyword: null });
    });
    it.each(["0", "-1", "10001", "1.5", "", " ", "abc", "Infinity", ["1", "2"], {}, null, true])(
        "V01: page=%jを拒否",
        (page) => {
            expect(schema.safeParse({ page }).success).toBe(false);
        },
    );
    it.each([undefined, null, "", " 　", "null"])("V02: keyword=%jは検索なし", (keyword) => {
        expect(schema.parse({ keyword, userId: 99, seller_id: 88 })).toEqual({ page: 1, keyword: null });
    });
    it("V02: trimし未知キーを除去、元入力を維持", () => {
        const input = { keyword: " シャツ ", seller_id: 99 };
        expect(schema.parse(input)).toEqual({ page: 1, keyword: "シャツ" });
        expect(input).toEqual({ keyword: " シャツ ", seller_id: 99 });
    });
    it.each([["a", "b"], {}, 1, false])("V02: keyword=%jを拒否", (keyword) => {
        expect(schema.safeParse({ keyword }).success).toBe(false);
    });
});

describe("P0 statusの正規化", () => {
    it.each(["active", "soldout"])("V03: %sを維持", (status) => {
        expect(schema.parse({ status }).status).toBe(status);
    });
    it.each([undefined, null, "", "ACTIVE", "draft", " active ", ["active"], { value: "active" }, 1, false])(
        "V03: %jはundefined",
        (status) => {
            expect(schema.parse({ status }).status).toBeUndefined();
        },
    );
});
