import rateLimit from "express-rate-limit";
import type { AuthUser } from "../authMiddleware.js";

export const createItemTrashRateLimit = rateLimit({
    windowMs: 1000 * 60 * 10,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as typeof req & { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});
