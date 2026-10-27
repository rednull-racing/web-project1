import { describe, expect, it } from "vitest";
import { createItemEditingCopyQuerySchema } from "../itemEditing.js";

describe("P0 コピー編集セッションのstatusクエリ", () => {
    it.each(["normal", "edit"])("QSTATUS01: %sをそのまま受理して未知キーを除去する", (status) => {
        const input = { status, userId: "8", itemId: "999" };
        expect(createItemEditingCopyQuerySchema.parse(input)).toEqual({ status });
        expect(input).toEqual({ status, userId: "8", itemId: "999" });
    });
    it.each([
        {},
        { status: undefined },
        { status: null },
        { status: "" },
        { status: "active" },
        { status: "NORMAL" },
        { status: " edit" },
        { status: '"normal"' },
        { status: ["normal", "edit"] },
        { status: { value: "normal" } },
        { status: 1 },
        { status: true },
        undefined,
        null,
    ])("QSTATUS02: 不正または欠落したquery=%jを拒否する", (input) => {
        expect(createItemEditingCopyQuerySchema.safeParse(input).success).toBe(false);
    });
});
