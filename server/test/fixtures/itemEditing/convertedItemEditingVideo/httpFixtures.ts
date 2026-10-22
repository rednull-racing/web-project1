import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
};

export const makeVideoHttpApp = async () => {
    const { itemEditingVideoResponse } = await import("../../../../src/middleware/itemEditingVideoResponse.js");
    const { default: router } = await import("../../../../src/routes/itemEditing.js");
    const { errorHandler } = await import("../../../../src/middleware/errorHandler.js");
    const app = express();
    app.set("trust proxy", 1);
    app.use(itemEditingVideoResponse);
    app.use(express.json());
    app.use("/api/item-editing", router);
    app.use(errorHandler);
    return app;
};

export const makeVideoToken = (secret: string, id = 7, expiresIn = 7200) =>
    jwt.sign({ id, email: "video-test@example.test", admin: false }, secret, { expiresIn });

export const patchVideo = (app: ReturnType<typeof express>, secret: string, id: number | string = 101, userId = 7) =>
    request(app).patch(`/api/item-editing/${id}/convert`).set("Authorization", "Bearer " + makeVideoToken(secret, userId));
