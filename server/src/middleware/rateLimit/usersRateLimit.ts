import rateLimit from "express-rate-limit";
import { AuthUser } from "../authMiddleware.js";

export const profileEditRateLimit = rateLimit({
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

export const editPhoneNumberRateLimit = rateLimit({
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

export const requestHonninRateLimit = rateLimit({
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

export const getProfileRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getStarRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getProfileMetadataRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getMyPageRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 80,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getInquiryRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getPhoneNumberRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 150,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getProfileEditRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getHonninRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getTransferPointsRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getTransferRequestRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getPointsRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getUriagekinRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getAddressRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getAccountRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getNameRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getMyIdcardRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});

export const getUserIdFileRateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
});
