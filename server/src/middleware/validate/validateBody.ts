import type { NextFunction, Request, Response } from "express-serve-static-core";
import { z } from "zod";
import { AppError } from "../../errors.js";

declare module "express-serve-static-core" {
    interface Request {
        validatedBody?: unknown;
    }
}

export function validateBody<T extends z.ZodType>(schema: T) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);

        if (!result.success) {
            console.error(result.error.issues);
            throw new AppError("INVALID_BODY", 400);
        }

        req.validatedBody = result.data;

        next();
    };
}
