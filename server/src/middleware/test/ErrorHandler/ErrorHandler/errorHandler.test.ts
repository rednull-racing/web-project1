import type { Request, Response } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../../errorHandler.js";
import { AppError } from "../../../../errors.js";
import {
    internalErrorResponse,
    invalidJsonResponse,
    makeDatabaseError,
    makeParseError,
    privateMarker,
} from "../../../../../test/fixtures/ErrorHandler/ErrorHandler/fixtures.js";

const invoke = (error: unknown) => {
    const json = vi.fn(),
        status = vi.fn().mockReturnValue({ json }),
        next = vi.fn();
    errorHandler(error, {} as Request, { status } as unknown as Response, next);
    return { status, json, next };
};
beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe("P0/P1: ErrorHandler / ErrorHandler 単体", () => {
    it("U01: body-parserのJSON SyntaxErrorだけを安全な400にする", () => {
        const error = makeParseError(),
            result = invoke(error);
        expect(result.status).toHaveBeenCalledExactlyOnceWith(400);
        expect(result.json).toHaveBeenCalledExactlyOnceWith(invalidJsonResponse);
        expect(JSON.stringify(result.json.mock.calls)).not.toContain(privateMarker);
        expect(result.next).not.toHaveBeenCalled();
        expect(console.error).not.toHaveBeenCalled();
        expect(error.body).toContain(privateMarker);
    });
    it.each([
        { label: "DB例外", make: makeDatabaseError },
        { label: "通常Error", make: () => new Error(privateMarker) },
    ])("U02 AF-JSON02: $labelは固定500で内部情報を返さない", ({ make }) => {
        const error = make(),
            result = invoke(error);
        expect(result.status).toHaveBeenCalledExactlyOnceWith(500);
        expect(result.json).toHaveBeenCalledExactlyOnceWith(internalErrorResponse);
        expect(result.next).not.toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledExactlyOnceWith(error);
    });
    it.each([
        { status: 400, code: "INVALID_PARAMS", message: undefined },
        { status: 404, code: "ITEM_DRAFT_NOT_FOUND", message: undefined },
        { status: 429, code: "RATE_LIMITED", message: "時間をおいてお試しください。" },
        { status: 400, code: "CUSTOM_ERROR", message: "" },
    ])("U03: AppError $status/$code の公開規約を維持", ({ status, code, message }) => {
        const result = invoke(new AppError(code, status, message));
        expect(result.status).toHaveBeenCalledExactlyOnceWith(status);
        expect(result.json).toHaveBeenCalledExactlyOnceWith({ code, message: message ?? code });
        expect(result.next).not.toHaveBeenCalled();
    });
    it.each(
        [400, 401, 403, 404, 413, 415, 422].flatMap((status) =>
            ["status", "statusCode"].map((key) => ({ key, status })),
        ),
    )("U04: 任意Errorの$key=$statusを信用しない", ({ key, status }) => {
        const result = invoke(Object.assign(new Error(privateMarker), { [key]: status }));
        expect(result.status).toHaveBeenCalledExactlyOnceWith(500);
        expect(result.json).toHaveBeenCalledExactlyOnceWith(internalErrorResponse);
        expect(result.next).not.toHaveBeenCalled();
    });
    it.each([
        { label: "typeなし", fields: { status: 400 } },
        { label: "別type", fields: { status: 400, type: "entity.too.large" } },
        { label: "statusなし", fields: { type: "entity.parse.failed" } },
        { label: "statusCodeだけ", fields: { type: "entity.parse.failed", statusCode: 400 } },
        { label: "文字列status", fields: { type: "entity.parse.failed", status: "400" } },
        { label: "別status", fields: { type: "entity.parse.failed", status: 500 } },
        { label: "通常SyntaxError", fields: {} },
    ])("U05: SyntaxErrorでも$labelなら500", ({ fields }) => {
        const result = invoke(Object.assign(new SyntaxError(privateMarker), fields));
        expect(result.status).toHaveBeenCalledExactlyOnceWith(500);
        expect(result.json).toHaveBeenCalledExactlyOnceWith(internalErrorResponse);
        expect(result.next).not.toHaveBeenCalled();
    });
    it.each([
        {
            label: "通常Error",
            make: () => Object.assign(new Error(privateMarker), { type: "entity.parse.failed", status: 400 }),
        },
        { label: "通常object", make: () => ({ type: "entity.parse.failed", status: 400, body: privateMarker }) },
    ])("U06: $labelへtype/statusを付けても400にならない", ({ make }) => {
        const result = invoke(make());
        expect(result.status).toHaveBeenCalledExactlyOnceWith(500);
        expect(result.json).toHaveBeenCalledExactlyOnceWith(internalErrorResponse);
        expect(result.next).not.toHaveBeenCalled();
    });
    it.each([null, undefined, privateMarker, 123, {}])("U07: 非Error値%sでも安全な500", (error) => {
        const result = invoke(error);
        expect(result.status).toHaveBeenCalledExactlyOnceWith(500);
        expect(result.json).toHaveBeenCalledExactlyOnceWith(internalErrorResponse);
        expect(result.next).not.toHaveBeenCalled();
    });
});
