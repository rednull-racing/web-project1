import type { NextFunction, Request, Response } from "express-serve-static-core";
import { z } from "zod";
import { AppError } from "../../errors.js";

declare module "express-serve-static-core" {
    interface Request {
        validatedQuery?: unknown;
    }
}

export function validateQuery<T extends z.ZodType>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.query);

        if (!result.success) {
            console.error(result.error.issues);
            throw new AppError("INVALID_QUERY", 400);
        }

        req.validatedQuery = result.data;

        next();
    };
}
