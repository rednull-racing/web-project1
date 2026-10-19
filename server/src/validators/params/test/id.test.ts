import { describe, expect, it } from "vitest";
import { idParamSchema } from "../id.js";
import { acceptedSpellings, invalidIds } from "../../../../test/fixtures/itemDraft/deleteItemDraft/fixtures.js";

describe("P0/P1: deleteItemDraftの共通ID境界", () => {
    it.each(["1", "2", "2147483646", "2147483647"])("V01: %sをnumberへ変換する", id => {
        expect(idParamSchema.parse({ id })).toEqual({ id: Number(id) });
    });
    it.each(invalidIds)("$id: id=$valueを拒否しidへissueを付ける", ({ value }) => {
        const result = idParamSchema.safeParse({ id: value });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.issues[0].path).toEqual(["id"]);
    });
    it("V04: id欠落を拒否する", () => expect(idParamSchema.safeParse({}).success).toBe(false));
    it("V06: 未知キーを除去し元入力を変更しない", () => {
        const input = { id: "101", seller_id: 8, extra: "x" };
        expect(idParamSchema.parse(input)).toEqual({ id: 101 });
        expect(input).toEqual({ id: "101", seller_id: 8, extra: "x" });
    });
    it.each([1, 2147483647, 0, -1, 1.5, NaN, Infinity])("V07: 非HTTP数値%sの境界", id => {
        const result = idParamSchema.safeParse({ id });
        expect(result.success).toBe([1, 2147483647].includes(id));
        if (result.success) expect(result.data).toEqual({ id });
    });
    it.each(acceptedSpellings)("O01: 表記%sは数値%sとして受理する", (id, expected) => {
        expect(idParamSchema.parse({ id })).toEqual({ id: expected });
    });
    it.each([
        { value: true, output: 1 }, { value: false, output: null }, { value: [], output: null },
        { value: [1], output: 1 }, { value: [1, 2], output: null }, { value: {}, output: null },
    ])("O02: 非HTTP型$valueのcoerce挙動", ({ value, output }) => {
        const result = idParamSchema.safeParse({ id: value });
        expect(result.success).toBe(output !== null);
        if (result.success) expect(result.data).toEqual({ id: output });
    });
});
