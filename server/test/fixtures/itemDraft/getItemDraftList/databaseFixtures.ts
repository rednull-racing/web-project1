import "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { Op, QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic } from "sequelize";
import db, { ItemDraft, User } from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";
export { sequelize, ItemDraft, User };
const url = process.env.DATABASE_URL;
if (!url || new URL(url).pathname !== "/test_db" || process.env.NODE_ENV !== "test")
    throw new Error("DB_TEST_STOP: invalid observer configuration");
export const observer = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});
const draftIds: number[] = [];
const userIds: number[] = [];
let safe = false;
beforeAll(async () => {
    for (const connection of [sequelize, db.sequelize, observer]) {
        if (connection.getDatabaseName() !== "test_db") throw new Error("DB_TEST_STOP: configured database differs");
        const [row] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
        });
        if (row.name !== "test_db") throw new Error("DB_TEST_STOP: actual database differs");
    }
    for (const model of [User, ItemDraft] as ModelStatic<Model>[]) {
        const columns = await sequelize.getQueryInterface().describeTable(model.getTableName());
        for (const [name, attribute] of Object.entries(model.getAttributes())) {
            if (!columns[name] || columns[name].allowNull !== (attribute.allowNull !== false && !attribute.primaryKey))
                throw new Error("DB_TEST_STOP: required schema differs: " + model.getTableName() + "." + name);
        }
    }
    const columns = await sequelize.getQueryInterface().describeTable("item_draft");
    if (
        !columns.id.type.includes("INTEGER") ||
        !columns.price.type.includes("INTEGER") ||
        !columns.createdAt.type.includes("TIMESTAMP")
    )
        throw new Error("DB_TEST_STOP: list column types differ");
    safe = true;
    User.addHook("afterCreate", "draftListTrack", (row) => {
        const id: unknown = row.get("id");
        if (typeof id !== "number") throw new Error("Invalid fixture ID");
        userIds.push(id);
    });
    ItemDraft.addHook("afterCreate", "draftListTrack", (row) => {
        const id: unknown = row.get("id");
        if (typeof id !== "number") throw new Error("Invalid fixture ID");
        draftIds.push(id);
    });
}, 30000);
beforeEach(() => {
    draftIds.length = 0;
    userIds.length = 0;
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    if (draftIds.length) await ItemDraft.destroy({ where: { id: { [Op.in]: draftIds } } });
    if (userIds.length) await User.destroy({ where: { id: { [Op.in]: userIds } } });
    expect(await ItemDraft.count({ where: { id: { [Op.in]: draftIds } } })).toBe(0);
    expect(await User.count({ where: { id: { [Op.in]: userIds } } })).toBe(0);
});
afterAll(async () => {
    User.removeHook("afterCreate", "draftListTrack");
    ItemDraft.removeHook("afterCreate", "draftListTrack");
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
export const snapshotCreatedDrafts = () =>
    ItemDraft.findAll({
        where: { id: { [Op.in]: draftIds } },
        order: [["id", "ASC"]],
        raw: true,
    });
export const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
};
