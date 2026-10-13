import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../../src/errors.js";
import { validateBody } from "../../../../src/middleware/validate/validateBody.js";
import { createItemEditingDraftBodySchema as schema } from "../../../../src/validators/body/itemEditing.js";
import { invalidIds, makeBody } from "./fixtures.js";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());
describe("P0: 正整数IDのschemaとvalidateBody", () => {
    it.each([1, 2, 11])("V01: 下書きID=%sを数値のまま受理する", (id) => {
        expect(schema.parse(makeBody(id))).toEqual({ itemDraftId: id });
    });
    it.each(invalidIds)("V02 V03: $nameを拒否する", ({ value }) => {
        const result = schema.safeParse({ itemDraftId: value });
        expect(result.success).toBe(false);
        if (!result.success) expect(result.error.issues[0].path).toEqual(["itemDraftId"]);
    });
    it.each([null, [], undefined])("V04: body=%jを拒否する", (body) => {
        expect(schema.safeParse(body).success).toBe(false);
    });
    it.each([NaN, Infinity, -Infinity])("V04: JSON外の数値%sをschema直接呼出しで拒否する", (value) => {
        expect(schema.safeParse({ itemDraftId: value }).success).toBe(false);
    });
    it("V05 V06: 未知キーを除去した検証済みbodyだけを設定しnextを呼ぶ", () => {
        const body = { ...makeBody(), userId: 8, seller_id: 8, unknown: "ignored" };
        expect(schema.parse(body)).toEqual(makeBody());
        const req = { body } as Request,
            next = vi.fn();
        validateBody(schema)(req, {} as Response, next);
        expect(req.validatedBody).toEqual(makeBody());
        expect(req.validatedBody).not.toBe(body);
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it.each(invalidIds)("V06: $nameでAppErrorをthrowし値設定・nextを行わない", ({ value }) => {
        const req = { body: { itemDraftId: value } } as Request,
            next = vi.fn();
        const run = () => validateBody(schema)(req, {} as Response, next);
        expect(run).toThrow(AppError);
        expect(run).toThrow(expect.objectContaining({ code: "INVALID_BODY", statusCode: 400 }));
        expect(req.validatedBody).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
    });
});
describe("P2: 業務上限未確定の観測", () => {
    it.each([2147483646, 2147483647, 2147483648])("O01: INTEGER境界%sにもschemaの業務max制約はない", (id) => {
        expect(schema.parse(makeBody(id))).toEqual(makeBody(id));
    });
});
