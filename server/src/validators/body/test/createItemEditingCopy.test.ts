import type { Request, Response } from "express-serve-static-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";
import { validateBody } from "../../../middleware/validate/validateBody.js";
import { createItemEditingCopyBodySchema as schema } from "../itemEditing.js";

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("P0 入力schema・validateBody", () => {
    it.each([1, 2, 2147483646, 2147483647])("V01 V06 AF-ID02: INTEGER範囲内の%sを変換せず受理する", (itemId) => {
        expect(schema.parse({ itemId })).toEqual({ itemId });
    });
    it.each(
        [
            -1,
            0,
            -0,
            0.5,
            1.5,
            "1",
            "",
            " ",
            "1e2",
            true,
            false,
            null,
            undefined,
            NaN,
            Infinity,
            -Infinity,
            [],
            {},
            2147483648,
            Number.MAX_SAFE_INTEGER,
            Number.MAX_SAFE_INTEGER + 1,
        ].map((itemId) => ({ itemId })),
    )("V01 V02 V03 V06: itemId=$itemIdを拒否しitemIdへissueを付ける", ({ itemId }) => {
        const parsed = schema.safeParse({ itemId });
        expect(parsed.success).toBe(false);
        if (!parsed.success) expect(parsed.error.issues.some((issue) => issue.path[0] === "itemId")).toBe(true);
    });
    it.each([{}, null, undefined, [], "text", 1].map((body) => ({ body })))(
        "V02 V04: body=$bodyを拒否する",
        ({ body }) => {
            expect(schema.safeParse(body).success).toBe(false);
        },
    );
    it("V05 V07: 未知キーを除去した結果だけvalidatedBodyへ設定してnextする", () => {
        const body = {
            itemId: 101,
            userId: 8,
            seller_id: 8,
            itemEditingId: 999,
            status: "soldout",
            name: "改ざん",
            price: 1,
            attributes: { inventory: 999 },
        };
        const req = { body } as Request;
        const next = vi.fn();
        validateBody(schema)(req, {} as Response, next);
        expect(req.validatedBody).toEqual({ itemId: 101 });
        expect(req.body).toBe(body);
        expect(req.body).toHaveProperty("seller_id", 8);
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it.each([{}, { itemId: 0 }, { itemId: "1" }, { itemId: null }])(
        "V08: body=%jは同期AppErrorで停止しvalidatedBody/nextを設定しない",
        (body) => {
            const req = { body } as Request;
            const next = vi.fn();
            let caught: unknown;
            try {
                validateBody(schema)(req, {} as Response, next);
            } catch (error) {
                caught = error;
            }
            expect(caught).toBeInstanceOf(AppError);
            expect(caught).toMatchObject({ code: "INVALID_BODY", statusCode: 400 });
            expect(req).not.toHaveProperty("validatedBody");
            expect(next).not.toHaveBeenCalled();
        },
    );
});
