import { readFileSync } from "node:fs";
import express from "express";
import type { ErrorRequestHandler } from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { parseMultipartBody } from "../../../../../src/middleware/multipart.js";

const fields = [
    { name: "frontIdCard", maxCount: 1 },
    { name: "permitFiles", maxCount: 10 },
];
const makeApp = () => {
    const app = express();
    const controller = vi.fn((_req, res: express.Response) => {
        res.sendStatus(204);
    });
    app.post("/upload", ...parseMultipartBody(fields), controller);
    const errors: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
        res.status(400).json({ code: error instanceof Error && "code" in error ? error.code : "INVALID_MULTIPART" });
    };
    app.use(errors);
    return { app, controller };
};

describe("P0: multipart実parserとHTTP境界（DB/AWSなし）", () => {
    it("M09: 細工したtext field名による配列長超過例外を拒否し、次の正常送信を処理する", async () => {
        const { app, controller } = makeApp();
        // 上流87a584eの再現条件: 最大配列長の疎配列へ追加するとRangeErrorになる。
        const result = await request(app)
            .post("/upload")
            .field("payload[4294967294]", "a")
            .field("payload[]", "overflow");
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "INVALID_FIELD_NAME" });
        expect(controller).not.toHaveBeenCalled();
        expect((await request(app).post("/upload").attach("frontIdCard", Buffer.from("ok"), "ok.png")).status).toBe(
            204,
        );
        expect(controller).toHaveBeenCalledTimes(1);
    });
    it("M01: 稼働multipartルートは認証とレート制限を解析より先に実行する", () => {
        for (const name of ["shopSignup", "shopInfoEdit", "users", "idCard"]) {
            const source = readFileSync(new URL(`../../../../../src/routes/${name}.ts`, import.meta.url), "utf8");
            const routes = source.split(/router\.(?:post|patch)\(/).slice(1);
            for (const route of routes.filter((value) => value.includes("...parseMultipartBody("))) {
                const beforeParser = route.split("...parseMultipartBody(")[0];
                expect(beforeParser, name).toContain("authenticateToken,");
                expect(beforeParser, name).toMatch(/\w+RateLimit,/);
            }
        }
    });
    it("M02: 正常画像をファイル情報・bufferとともに渡す", async () => {
        const { app, controller } = makeApp();
        const result = await request(app).post("/upload").attach("frontIdCard", Buffer.from("front"), "front.png");
        expect(result.status).toBe(204);
        expect(controller).toHaveBeenCalledTimes(1);
        expect(controller.mock.calls[0]?.[0].body).toEqual({
            frontIdCard: { fileName: "front.png", contentType: "image/png", size: 5, buffer: Buffer.from("front") },
            permitFiles: [],
        });
    });
    it.each(["unknown", "frontIdCard"])("M03: 不正fieldまたは個数超過 %s を拒否する", async (field) => {
        const { app, controller } = makeApp();
        const result = await request(app)
            .post("/upload")
            .attach("frontIdCard", Buffer.from("front"), "front.png")
            .attach(field, Buffer.from("extra"), "extra.png");
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "LIMIT_UNEXPECTED_FILE" });
        expect(controller).not.toHaveBeenCalled();
    });
    it("M04: 10MiB超過を拒否する", async () => {
        const { app, controller } = makeApp();
        const result = await request(app)
            .post("/upload")
            .attach("frontIdCard", Buffer.alloc(10 * 1024 * 1024 + 1), "large.png");
        expect(result.status).toBe(400);
        expect(result.body).toEqual({ code: "LIMIT_FILE_SIZE" });
        expect(controller).not.toHaveBeenCalled();
    });
    it("M05: 終端欠落を拒否し次の正常リクエストも処理する", async () => {
        const { app, controller } = makeApp();
        const result = await request(app)
            .post("/upload")
            .set("Content-Type", "multipart/form-data; boundary=cut")
            .send(
                '--cut\r\nContent-Disposition: form-data; name="frontIdCard"; filename="a.png"\r\nContent-Type: image/png\r\n\r\ntruncated',
            );
        expect(result.status).toBe(400);
        expect(controller).not.toHaveBeenCalled();
        const healthy = await request(app).post("/upload").attach("frontIdCard", Buffer.from("front"), "front.png");
        expect(healthy.status).toBe(204);
        expect(controller).toHaveBeenCalledTimes(1);
    });
});
