import type { Request, Response } from "express-serve-static-core";
import { describe, expect, it, vi } from "vitest";
import { itemDraftVideoResponse } from "../itemDraftVideoResponse.js";

describe("P1 公開HTTP変換境界", () => {
    it.each(["headersのみ", "statusMessage付き"])(
        "M01: %sの内部statusを送信直前まで保持しheadersを転送する",
        (mode) => {
            const req = { method: "PATCH", path: "/api/item-draft/101/convert" } as Request;
            const writeHead = vi.fn(),
                next = vi.fn();
            const res = { statusCode: 401, writeHead } as unknown as Response;
            writeHead.mockReturnValue(res);
            itemDraftVideoResponse(req, res, next);
            expect(res.statusCode).toBe(401);
            expect(writeHead).not.toHaveBeenCalled();
            expect(next).toHaveBeenCalledExactlyOnceWith();
            const headers = { "Retry-After": "600", "Content-Type": "application/json" };
            const result =
                mode === "headersのみ" ? res.writeHead(401, headers) : res.writeHead(429, "Too Many Requests", headers);
            expect(result).toBe(res);
            expect(writeHead).toHaveBeenCalledExactlyOnceWith(202, headers);
            expect(writeHead.mock.calls[0][1]).toBe(headers);
            expect(res.statusMessage).toBe("Accepted");
            expect(writeHead.mock.contexts[0]).toBe(res);
        },
    );
    it.each([
        { method: "POST", path: "/api/item-draft/101/convert" },
        { method: "PATCH", path: "/api/item-draft/101/convert/other" },
        { method: "PATCH", path: "/api/video/101/convert" },
    ])("M02: 対象外$method $pathは書き換えない", (input) => {
        const writeHead = vi.fn(),
            next = vi.fn();
        const res = { writeHead } as unknown as Response;
        itemDraftVideoResponse(input as Request, res, next);
        expect(res.writeHead).toBe(writeHead);
        expect(next).toHaveBeenCalledExactlyOnceWith();
    });
});
