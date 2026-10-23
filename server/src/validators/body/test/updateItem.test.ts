import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { updateItemBodySchema } from "../items.js";
import { validateBody } from "../../../middleware/validate/validateBody.js";
import { AppError } from "../../../errors.js";
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());
const invalid = [
    0,
    -1,
    2147483648,
    Number.MAX_SAFE_INTEGER,
    1.5,
    undefined,
    null,
    "11",
    "1e1",
    "1 OR 1=1",
    "../11",
    "",
    true,
    false,
    [],
    {},
    NaN,
    Infinity,
    -Infinity,
];
describe("V schemaと実validateBody", () => {
    it.each([1, 2147483646, 2147483647])("V01: %sを維持し未知キー除去", (value) => {
        const body = {
            itemEditingId: value,
            userId: 999,
            seller_id: 999,
            itemId: 99,
            status: "soldout",
            price: 1,
            attributes: {},
        };
        const original = structuredClone(body);
        expect(updateItemBodySchema.parse(body)).toEqual({ itemEditingId: value });
        expect(body).toEqual(original);
        const req = { body } as Request;
        const next = vi.fn();
        validateBody(updateItemBodySchema)(req, {} as Response, next);
        expect(req.validatedBody).toEqual({ itemEditingId: value });
        expect(req.body).toBe(body);
        expect(body).toEqual(original);
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it.each(invalid)("V01: ID=%jを拒否", (value) => {
        const body = { itemEditingId: value };
        expect(updateItemBodySchema.safeParse(body).success).toBe(false);
        const req = { body } as Request;
        const next = vi.fn();
        const invoke = () => validateBody(updateItemBodySchema)(req, {} as Response, next);
        expect(invoke).toThrow(AppError);
        expect(invoke).toThrow(expect.objectContaining({ code: "INVALID_BODY", statusCode: 400 }));
        expect(next).not.toHaveBeenCalled();
        expect(req.validatedBody).toBeUndefined();
    });
    it.each([{}, null, [], 1, "str", undefined])("V01: body=%jを拒否", (body) => {
        expect(updateItemBodySchema.safeParse(body).success).toBe(false);
        expect(() => validateBody(updateItemBodySchema)({ body } as Request, {} as Response, vi.fn())).toThrow(
            expect.objectContaining({ code: "INVALID_BODY", statusCode: 400 }),
        );
    });
});
