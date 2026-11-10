import "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { Op, QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic } from "sequelize";
import db, { Item, Sale, User, Video } from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";

export { sequelize, Item, Sale, User, Video };
const url = process.env.DATABASE_URL;
if (!url || new URL(url).pathname !== "/test_db" || process.env.NODE_ENV !== "test")
    throw new Error("DB_TEST_STOP: invalid observer configuration");
export const observer = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});
const tracked = [
    { model: Item as ModelStatic<Model>, ids: [] as number[] },
    { model: Video as ModelStatic<Model>, ids: [] as number[] },
    { model: Sale as ModelStatic<Model>, ids: [] as number[] },
    { model: User as ModelStatic<Model>, ids: [] as number[] },
];
let safe = false;
beforeAll(async () => {
    for (const connection of [sequelize, db.sequelize, observer]) {
        if (connection.getDatabaseName() !== "test_db") throw new Error("DB_TEST_STOP: configured database differs");
        const [row] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
        });
        if (row.name !== "test_db") throw new Error("DB_TEST_STOP: actual database differs");
        for (const { model } of tracked) {
            const columns = await connection.getQueryInterface().describeTable(model.getTableName());
            for (const [name, attribute] of Object.entries(model.getAttributes())) {
                if (
                    !columns[name] ||
                    columns[name].allowNull !== (attribute.allowNull !== false && !attribute.primaryKey)
                )
                    throw new Error("DB_TEST_STOP: required schema differs: " + model.getTableName() + "." + name);
            }
        }
        const columns = await connection.getQueryInterface().describeTable("item");
        if (
            !columns.id.type.includes("INTEGER") ||
            !columns.price.type.includes("INTEGER") ||
            !columns.uploaded_at.type.includes("TIMESTAMP") ||
            !columns.search_text.type.includes("TEXT")
        )
            throw new Error("DB_TEST_STOP: uploaded list column types differ");
        const foreignKeys = await connection.query<{ columnName: string; referencedTableName: string }>(
            `SELECT a.attname AS "columnName", target.relname AS "referencedTableName"
             FROM pg_constraint c
             JOIN pg_class source ON source.oid=c.conrelid
             JOIN pg_class target ON target.oid=c.confrelid
             JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
             WHERE c.contype='f' AND c.conrelid='public.item'::regclass`,
            { type: QueryTypes.SELECT },
        );
        for (const [columnName, referencedTableName] of [
            ["seller_id", "user"],
            ["video_id", "video"],
            ["sale_id", "sale"],
        ]) {
            if (
                !foreignKeys.some(
                    (key) => key.columnName === columnName && key.referencedTableName === referencedTableName,
                )
            )
                throw new Error("DB_TEST_STOP: uploaded list foreign keys differ");
        }
    }
    safe = true;
    for (const { model, ids } of tracked) {
        model.addHook("afterCreate", "uploadedListTrack", (row) => {
            const id: unknown = row.get("id");
            if (typeof id !== "number") throw new Error("Invalid fixture ID");
            ids.push(id);
        });
    }
}, 30000);
beforeEach(() => {
    for (const entry of tracked) entry.ids.length = 0;
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    for (const { model, ids } of tracked) {
        if (ids.length) await model.destroy({ where: { id: { [Op.in]: ids } } });
        expect(await model.count({ where: { id: { [Op.in]: ids } } })).toBe(0);
    }
});
afterAll(async () => {
    for (const { model } of tracked) model.removeHook("afterCreate", "uploadedListTrack");
    try {
        const results = await Promise.allSettled([sequelize.close(), db.sequelize.close(), observer.close()]);
        expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    } finally {
        vi.unstubAllEnvs();
    }
});
export const seed = async () => {
    if (!safe) throw new Error("DB_TEST_STOP: guards incomplete");
    const prefix = randomUUID();
    const owner = await User.create({ email: prefix + "@example.test", password: "unused" });
    const other = await User.create({ email: prefix + "-other@example.test", password: "unused" });
    return { owner, other };
};
export const createItem = (data: Parameters<typeof Item.create>[0]) =>
    Item.create({
        uploaded_at: new Date("2026-11-06T00:00:00Z"),
        ...data,
    });
export const snapshotCreated = async () => {
    return await Promise.all(
        tracked.map(({ model, ids }) =>
            model.findAll({
                where: { id: { [Op.in]: ids } },
                order: [["id", "ASC"]],
                raw: true,
            }),
        ),
    );
};
export const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};
