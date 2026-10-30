import express from "express";
import jwt from "jsonwebtoken";

export const makeHttpApp = async () => {
    const { default: router } = await import("../../../../src/routes/itemEditing.js");
    const { errorHandler } = await import("../../../../src/middleware/errorHandler.js");
    const app = express();
    app.use(express.json());
    app.use("/api/item-editing", router);
    app.use(errorHandler);
    return app;
};
export const makeToken = (secret: string, id = 7, expiresIn = 7200) =>
    jwt.sign({ id, email: "confirm@example.test", admin: false }, secret, { expiresIn });
