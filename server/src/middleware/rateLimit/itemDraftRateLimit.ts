import rateLimit from "express-rate-limit";
import type { AuthUser } from "../authMiddleware.js";

export const convertItemDraftVideoRateLimit = rateLimit({
    windowMs: 1000 * 60 * 10,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as typeof req & { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});

export const createItemDraftRateLimit = rateLimit({
    windowMs: 1000 * 60 * 10,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const deleteItemDraftRateLimit = rateLimit({
    windowMs: 1000 * 60 * 5,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const getItemDraftPageRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as typeof req & { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});

export const getItemDraftPageMetadataRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authReq = req as typeof req & { user: AuthUser };
        return `admin:${authReq.user.id}`;
    },
});
