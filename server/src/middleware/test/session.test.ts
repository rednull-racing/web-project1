import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { sessionMiddleware } from "../session.js";

const args = (cookies?: Record<string, string | undefined>) => {
    const req = { cookies } as Request;
    const cookie = vi.fn();
    const res = { cookie } as unknown as Response;
    const next = vi.fn();
    return { req, res, cookie, next: next as NextFunction, nextSpy: next };
};

describe("sessionMiddlewareのCookie引継ぎとUUID発行", () => {
    it("S01: 既存のsession_idをそのまま引き継ぎCookieを再発行しない", () => {
        const a = args({ session_id: "legacy-session-value", other: "ignored" });
        sessionMiddleware(a.req, a.res, a.next);
        expect(a.req.sessionId).toBe("legacy-session-value");
        expect(a.cookie).not.toHaveBeenCalled();
        expect(a.nextSpy).toHaveBeenCalledExactlyOnceWith();
    });
    it.each([undefined, {}, { session_id: "" }])("S02: cookies=%jでUUID v4を発行して30日Cookieへ設定", (cookies) => {
        const a = args(cookies);
        sessionMiddleware(a.req, a.res, a.next);
        expect(a.req.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(a.cookie).toHaveBeenCalledExactlyOnceWith("session_id", a.req.sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 30,
            path: "/",
        });
        expect(a.nextSpy).toHaveBeenCalledExactlyOnceWith();
    });
    it("S03: 独立した要求には異なるUUIDを発行する", () => {
        const a = args(),
            b = args();
        sessionMiddleware(a.req, a.res, a.next);
        sessionMiddleware(b.req, b.res, b.next);
        expect(a.req.sessionId).not.toBe(b.req.sessionId);
    });
});
