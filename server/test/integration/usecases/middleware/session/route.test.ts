import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { sessionMiddleware } from "../../../../../src/middleware/session.js";

const makeApp = () => {
    const app = express();
    app.use(cookieParser());
    app.use(sessionMiddleware);
    app.get("/session", (req, res) => {
        res.json({ sessionId: req.sessionId });
    });
    return app;
};

describe("実cookie-parser・sessionMiddleware・HTTPの接続", () => {
    it("H01: UUIDのCookie発行と後続要求での引継ぎ", async () => {
        const app = makeApp();
        const first = await request(app).get("/session");
        expect(first.status).toBe(200);
        expect(first.body.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        const cookies = first.headers["set-cookie"] as unknown as string[];
        expect(cookies).toHaveLength(1);
        expect(cookies[0]).toContain(`session_id=${first.body.sessionId};`);
        expect(cookies[0]).toContain("Max-Age=2592000");
        expect(cookies[0]).toContain("Path=/");
        expect(cookies[0]).toContain("HttpOnly");
        expect(cookies[0]).toContain("SameSite=Lax");
        expect(cookies[0]).not.toContain("Secure");
        const second = await request(app).get("/session").set("Cookie", cookies[0].split(";")[0]);
        expect(second.status).toBe(200);
        expect(second.body).toEqual(first.body);
        expect(second.headers["set-cookie"]).toBeUndefined();
    });
    it("H02: 既存形式のIDも書き換えず利用する", async () => {
        const result = await request(makeApp())
            .get("/session")
            .set("Cookie", "session_id=existing-session; other=ignored");
        expect(result.status).toBe(200);
        expect(result.body).toEqual({ sessionId: "existing-session" });
        expect(result.headers["set-cookie"]).toBeUndefined();
    });
    it("H03: Cookieを持たない別要求へ異なるIDを返す", async () => {
        const app = makeApp();
        const first = await request(app).get("/session");
        const second = await request(app).get("/session");
        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(first.body.sessionId).not.toBe(second.body.sessionId);
    });
});
