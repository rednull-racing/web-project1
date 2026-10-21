import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
export const makeHttpApp = async () => {
    const { default: router } = await import("../../../../src/routes/items.js");
    const { errorHandler } = await import("../../../../src/middleware/errorHandler.js");
    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.use("/api/items", router);
    app.use(errorHandler);
    return app;
};
export const makeToken = (secret: string, id = 7, expiresIn = 7200) =>
    jwt.sign({ id, email: "publish@example.test", admin: false }, secret, { expiresIn });
export const post = (
    app: ReturnType<typeof express>,
    secret: string,
    body: object = { itemEditingId: 11 },
    userId = 7,
) =>
    request(app)
        .post("/api/items")
        .set("Authorization", "Bearer " + makeToken(secret, userId))
        .send(body);
