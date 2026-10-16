import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";

export const makeHttpApp = async () => {
    const { default: router } = await import("../../../../../src/routes/itemEditing.js");
    const { errorHandler } = await import("../../../../../src/middleware/errorHandler.js");
    const app = express();
    app.use(express.json());
    app.use("/api/item-editing", router);
    app.use(errorHandler);
    return app;
};
export const makeToken = (secret: string, id = 7, expiresIn = 7200) =>
    jwt.sign({ id, email: "copy-test@example.test", admin: false }, secret, { expiresIn });
export const postCopy = (
    app: ReturnType<typeof express>, secret: string, body: object = { itemId: 101 }, userId = 7,
) => request(app).post("/api/item-editing/copy")
    .set("Authorization", "Bearer " + makeToken(secret, userId)).send(body);
