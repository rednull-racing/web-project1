import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateParams } from "../validateParams.js";
import { idParamSchema } from "../../../validators/params/id.js";
import { AppError } from "../../../errors.js";
import { invalidIds } from "../../../../test/fixtures/itemDraft/deleteItemDraft/fixtures.js";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());
describe("P0/P1: deleteItemDraftのparams検証middleware", () => {
    it("M01: 数値化した検証値だけを格納しnextする", () => {
        const req = { params: { id: "101", extra: "x" } } as unknown as Request;
        const next = vi.fn();
        validateParams(idParamSchema)(req, {} as Response, next);
        expect(req.validatedParams).toEqual({ id: 101 });
        expect(req.params).toEqual({ id: "101", extra: "x" });
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
    it.each([...invalidIds, { id: "欠落", value: undefined }])("M02: $id/$valueではthrowして後続を止める", ({ value }) => {
        const req = { params: value === undefined ? {} : { id: value } } as unknown as Request;
        const next = vi.fn(), status = vi.fn(), json = vi.fn();
        const call = () => validateParams(idParamSchema)(req, { status, json } as unknown as Response, next);
        let failure: unknown;
        try { call(); } catch (error) { failure = error; }
        expect(failure).toBeInstanceOf(AppError);
        expect(failure).toMatchObject({ code: "INVALID_PARAMS", statusCode: 400 });
        expect(req.validatedParams).toBeUndefined();
        expect(next).not.toHaveBeenCalled();
        expect(status).not.toHaveBeenCalled();
        expect(json).not.toHaveBeenCalled();
    });
    it("M03: 再利用Requestの不正入力では既存検証値を上書きしない", () => {
        const previous = { id: 77 };
        const req = { params: { id: "bad" }, validatedParams: previous } as unknown as Request;
        const next = vi.fn();
        expect(() => validateParams(idParamSchema)(req, {} as Response, next)).toThrow(AppError);
        expect(req.validatedParams).toBe(previous);
        expect(next).not.toHaveBeenCalled();
    });
});
