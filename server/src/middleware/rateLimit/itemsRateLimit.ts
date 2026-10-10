import rateLimit from "express-rate-limit";
import { AuthUser } from "../authMiddleware.js";

export const createItemRateLimit = rateLimit({
    windowMs: 1000 * 60 * 10,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const createItemCopyRateLimit = rateLimit({
    windowMs: 1000 * 60 * 15,
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

export const uploadPublishItemRateLimit = rateLimit({
    windowMs: 1000 * 60 * 15,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const editSortItemRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const editAccessLogsRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
});

export const restoreItemRateLimit = rateLimit({
    windowMs: 1000 * 60 * 15,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const logicalDeleteItemRateLimit = rateLimit({
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

export const perfectDeleteItemRateLimit = rateLimit({
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

export const draftDeleteItemRateLimit = rateLimit({
    windowMs: 1000 * 60 * 10,
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

export const getItemListRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getItemRecommendRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getItemSearchRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getItemPageRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getItemUploadFormDataRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getItemHighlightRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
