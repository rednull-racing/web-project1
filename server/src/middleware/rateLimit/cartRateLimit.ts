import rateLimit from "express-rate-limit";
import type { AuthUser } from "../authMiddleware.js";

export const cartAddRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

export const cartDeleteRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

export const cartStatusRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getCartItemListRateLimit = rateLimit({
    windowMs: 60000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as unknown as { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});
