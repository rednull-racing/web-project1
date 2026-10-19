import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../../../../src/middleware/errorHandler.js";
import { AppError } from "../../../../../src/errors.js";
import { internalErrorResponse, invalidBodies, invalidJsonResponse, makeDatabaseError, privateMarker } from "../../../../fixtures/ErrorHandler/ErrorHandler/fixtures.js";

let app: ReturnType<typeof express>;
const reached = vi.fn();
beforeEach(() => {
    vi.clearAllMocks(); vi.spyOn(console, "error").mockImplementation(() => {});
    app = express(); app.use(express.json({ limit: "1kb" }));
    app.post("/parse", (req, res) => { reached(req.body); res.status(200).json({ ok: true }); });
    app.use(errorHandler);
});
afterEach(() => { vi.restoreAllMocks(); });
const errorApp = (error: unknown) => {
    const instance = express();
    instance.get("/failure", (_req, _res, next) => next(error));
    instance.use(errorHandler);
    return instance;
};

describe("P0/P1: ErrorHandler / ErrorHandler 実parserとの結合", () => {
    it.each(invalidBodies)("H01: $labelで400、後続handlerなし", async ({ body }) => {
        const result = await request(app).post("/parse").type("json").send(body);
        expect(result.status).toBe(400); expect(result.headers["content-type"]).toContain("application/json");
        expect(result.body).toEqual(invalidJsonResponse); expect(result.text).not.toContain(privateMarker);
        expect(reached).not.toHaveBeenCalled(); expect(console.error).not.toHaveBeenCalled();
    });
    it.each(["null", "42", '"value"'])("H02: strict parserのプリミティブ%s拒否も400", async body => {
        const result = await request(app).post("/parse").type("json").send(body);
        expect(result.status).toBe(400); expect(result.body).toEqual(invalidJsonResponse); expect(reached).not.toHaveBeenCalled();
    });
    it.each([
        { label: "object", body: '{"safe":1}', type: "json", expected: { safe: 1 } },
        { label: "array", body: "[1,2]", type: "json", expected: [1, 2] },
        { label: "空body", body: "", type: "json", expected: {} },
        { label: "非JSON", body: "not-json", type: "text", expected: {} },
    ])("H03: $labelは正常に後続へ渡す", async ({ body, type, expected }) => {
        const result = await request(app).post("/parse").type(type).send(body);
        expect(result.status).toBe(200); expect(result.body).toEqual({ ok: true });
        expect(reached).toHaveBeenCalledExactlyOnceWith(expected); expect(console.error).not.toHaveBeenCalled();
    });
    it.each([
        { label: "DB例外", make: makeDatabaseError },
        { label: "通常Error", make: () => new Error(privateMarker) },
        { label: "任意status", make: () => Object.assign(new Error(privateMarker), { status: 400, statusCode: 400 }) },
        { label: "無関係SyntaxError", make: () => new SyntaxError(privateMarker) },
    ])("H04 AF-JSON02: $labelの内部情報を返さず500", async ({ make }) => {
        const result = await request(errorApp(make())).get("/failure");
        expect(result.status).toBe(500); expect(result.body).toEqual(internalErrorResponse);
        expect(result.text).not.toContain(privateMarker);
    });
    it.each([400, 404, 429])("H05: AppError%sの既存公開応答を維持", async status => {
        const result = await request(errorApp(new AppError("EXPECTED_ERROR", status, "公開メッセージ"))).get("/failure");
        expect(result.status).toBe(status); expect(result.body).toEqual({ code: "EXPECTED_ERROR", message: "公開メッセージ" });
    });
    it.each(["サイズ超過", "charset未対応"])("H06: %sをJSON構文エラーと誤分類しない", async mode => {
        const req = request(app).post("/parse");
        const result = mode === "サイズ超過" ? await req.type("json").send(JSON.stringify({ value: "a".repeat(2000) })) : await req.set("Content-Type", "application/json; charset=iso-8859-1").send('{"safe":1}');
        expect(result.status).toBe(500); expect(result.body).toEqual(internalErrorResponse); expect(reached).not.toHaveBeenCalled();
    });
});
