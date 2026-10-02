import type { NextFunction, Request, Response } from "express-serve-static-core";
import { z } from "zod";
import { AppError } from "../../errors.js";

declare module "express-serve-static-core" {
    interface Request {
        validatedParams?: unknown;
    }
}

export function validateParams<T extends z.ZodType>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.params);

        if (!result.success) {
            console.error(result.error.issues);
            throw new AppError("INVALID_PARAMS", 400);
        }

        req.validatedParams = result.data;

        next();
    };
}
