import rateLimit from "express-rate-limit";
import type { AuthUser } from "../authMiddleware.js";

export const deleteWatchHistoryRateLimit = rateLimit({
    windowMs: 1000 * 60 * 10,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const getWatchItemListRateLimit = rateLimit({
    windowMs: 60000,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as unknown as { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});
