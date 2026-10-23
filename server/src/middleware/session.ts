import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express-serve-static-core";

declare module "express-serve-static-core" {
    interface Request {
        sessionId?: string;
    }
}

export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
    let sessionId = req.cookies?.session_id;

    if (!sessionId) {
        sessionId = randomUUID();
        res.cookie("session_id", sessionId, {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 * 30,
            path: "/",
        });
    }

    req.sessionId = sessionId;
    next();
}
