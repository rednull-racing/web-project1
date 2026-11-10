import rateLimit from "express-rate-limit";
import type { AuthUser } from "../authMiddleware.js";

export const addItemLikeRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
});

export const deleteItemLikeRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
});

export const itemLikeStatusRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const itemLikeCountRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const itemLikeUserListRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getItemLikeListRateLimit = rateLimit({
    windowMs: 60000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as unknown as { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});
