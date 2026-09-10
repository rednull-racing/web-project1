import rateLimit from "express-rate-limit";
import { AuthUser } from "../authMiddleware.js";

export const createShopSignupRateLimit = rateLimit({
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

export const signup2RateLimit = rateLimit({
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

export const signup3RateLimit = rateLimit({
    windowMs: 1000 * 60 * 15,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req) => {
        const authReq = req as unknown as {
            user: AuthUser;
        };

        return `admin:${authReq.user.id}`;
    },
});

export const shopSignup4RateLimit = rateLimit({
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

export const shopSignup5EditRateLimit = rateLimit({
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

export const shopSignup5RateLimit = rateLimit({
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

export const getShopSignup1RateLimit = rateLimit({
    windowMs: 1000 * 60,
    limit: 50,
    standardHeaders: true,
    legacyHeaders: false,
});
