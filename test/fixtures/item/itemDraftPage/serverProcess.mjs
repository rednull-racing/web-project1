// Isolated test process: production routers and middleware, without application cron startup.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const root = new URL("../../../../server/", import.meta.url);
const requireServer = createRequire(new URL("package.json", root));
const { parse } = requireServer("dotenv");
const env = parse(readFileSync(new URL(".env.test", root)));
if (new URL(env.DATABASE_URL).pathname !== "/test_db") throw new Error("E2E_ENV_STOP: isolated Express must use test_db");
Object.assign(process.env, env, { NODE_ENV: "test" });
process.chdir(root.pathname);
const { default: sequelize } = await import(new URL("src/db.ts", root).href);
const { default: models } = await import(new URL("src/models/index.ts", root).href);
const connections = [...new Set([sequelize, models.sequelize])];
for (const connection of connections) {
    if (connection.getDatabaseName() !== "test_db") throw new Error("E2E_ENV_STOP: actual Express DB configuration mismatch");
    const [[database]] = await connection.query("SELECT current_database() AS name");
    if (database.name !== "test_db") throw new Error("E2E_ENV_STOP: actual Express DB mismatch");
}
const database = { name: "test_db" };
const express = requireServer("express");
const cors = requireServer("cors");
const app = express();
app.use(cors({ origin: process.env.ITEM_DRAFT_E2E_CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
for (const [mount, file] of [["auth", "auth"], ["item-editing", "itemEditing"], ["item-draft", "itemDraft"], ["items", "items"], ["user", "users"]]) {
    const { default: router } = await import(new URL(`src/routes/${file}.ts`, root).href);
    app.use(`/api/${mount}`, router);
}
const { errorHandler } = await import(new URL("src/middleware/errorHandler.ts", root).href);
app.get("/__test__/database-proof", (_req, res) => res.json({ database: database.name }));
app.use(errorHandler);
const server = app.listen(Number(process.env.ITEM_DRAFT_E2E_EXPRESS_PORT), "127.0.0.1");
const close = async () => { server.close(); await Promise.all(connections.map((connection) => connection.close())); process.exit(); };
process.on("SIGTERM", close);
process.on("SIGINT", close);
