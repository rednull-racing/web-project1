import type { ErrorRequestHandler } from "express-serve-static-core";

import { AppError } from "../errors.js";

export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, next) => {
    void req;
    void next;

    console.error(err);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            code: err.code,
            message: err.publicMessage ?? err.code,
        });
    }

    res.status(500).json({
        error: "INTERNAL_SERVER_ERROR",
        message: "サーバーエラーが発生しました",
    });
};
