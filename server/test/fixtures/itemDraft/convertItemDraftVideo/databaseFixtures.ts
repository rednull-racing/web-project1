import { assertConnectionEnvironment } from "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic, Transaction } from "sequelize";
import db, { ItemDraft, ItemEditing, User } from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";

export { sequelize, ItemDraft, User };
assertConnectionEnvironment();
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DB_TEST_STOP: verified URL is missing");
export const observer = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0 },
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});
const connections = [...new Set([sequelize, db.sequelize, observer])];
const models: ModelStatic<Model>[] = [ItemDraft, ItemEditing, User];
const created = new Map<ModelStatic<Model>, Set<number>>();
let safe = false;
export const trackedIds = (model: ModelStatic<Model>) => [...(created.get(model) ?? [])];
export const assertSafe = () => {
    assertConnectionEnvironment();
    if (!safe) throw new Error("DB_TEST_STOP: connection and schema guards must pass before writing");
};

beforeAll(async () => {
    assertConnectionEnvironment();
    for (const connection of connections) {
        if (connection.getDatabaseName() !== "test_db")
            throw new Error("DB_TEST_STOP: configured database differs from test_db");
        const [database] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
        });
        if (database?.name !== "test_db") throw new Error("DB_TEST_STOP: actual database differs from test_db");
        const qi = connection.getQueryInterface();
        for (const model of models) {
            const columns = await qi.describeTable(model.getTableName());
            for (const [name, attribute] of Object.entries(model.getAttributes())) {
                if (!columns[name] || columns[name].allowNull !== (attribute.allowNull ?? true)) {
                    throw new Error(
                        `DB_TEST_STOP: ${model.tableName}.${name} exists=${Boolean(columns[name])} nullable=${columns[name]?.allowNull} expected=${attribute.allowNull ?? true}`,
                    );
                }
            }
        }
        const requiredTypes: Record<string, string> = {
            id: "INTEGER",
            name: "CHARACTER VARYING(255)",
            detail: "TEXT",
            image_url: "ARRAY",
            price: "INTEGER",
            item_condition_id: "INTEGER",
            seller_id: "INTEGER",
            first_image_url: "TEXT",
            gender_type: "USER-DEFINED",
            age_type: "USER-DEFINED",
            recommend: "BOOLEAN",
            category_id: "INTEGER",
            brand_id: "INTEGER",
            brand_aliases_id: "INTEGER",
            attributes: "JSONB",
            thumbnail_url: "TEXT",
            title: "CHARACTER VARYING(255)",
            summary: "TEXT",
            duration: "INTEGER",
            original_url: "TEXT",
            converted_url: "TEXT",
            video_status: "CHARACTER VARYING(255)",
            before_price: "INTEGER",
            discount_rate: "INTEGER",
            discount_amount: "INTEGER",
            sale_flag: "BOOLEAN",
            shipping_day_id: "INTEGER",
            shipping_service_id: "INTEGER",
            shipping_place_id: "INTEGER",
            shipping_service_free_text: "CHARACTER VARYING(255)",
            createdAt: "TIMESTAMP WITH TIME ZONE",
            updatedAt: "TIMESTAMP WITH TIME ZONE",
        };
        const typeRows = await connection.query<{ column_name: string; type: string }>(
            `SELECT column_name, CASE WHEN data_type = 'character varying'
             THEN upper(data_type) || '(' || character_maximum_length || ')'
             ELSE upper(data_type) END AS type
             FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'item_draft'`,
            { type: QueryTypes.SELECT },
        );
        for (const [name, type] of Object.entries(requiredTypes)) {
            if (typeRows.find((row) => row.column_name === name)?.type !== type)
                throw new Error(`DB_TEST_STOP: item_draft.${name} type differs`);
        }
        const foreignKeys = await connection.query<{
            column_name: string;
            referenced_table: string;
            referenced_column: string;
        }>(
            `SELECT key.column_name, target.table_name AS referenced_table, target.column_name AS referenced_column
             FROM information_schema.table_constraints constraint_row
             JOIN information_schema.key_column_usage key USING (constraint_catalog, constraint_schema, constraint_name)
             JOIN information_schema.constraint_column_usage target USING (constraint_catalog, constraint_schema, constraint_name)
             WHERE constraint_row.constraint_type = 'FOREIGN KEY'
             AND constraint_row.table_schema = 'public' AND constraint_row.table_name = 'item_draft'`,
            { type: QueryTypes.SELECT },
        );
        if (
            !foreignKeys.some(
                (key) =>
                    key.column_name === "seller_id" &&
                    key.referenced_table === "user" &&
                    key.referenced_column === "id",
            )
        ) {
            throw new Error("DB_TEST_STOP: item_draft owner FK is missing");
        }
        const [defaults] = await connection.query<{ valid: boolean }>(
            `SELECT bool_and(column_default IS NOT NULL) AS valid FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'item_draft'
             AND column_name IN ('gender_type', 'age_type', 'recommend', 'attributes', 'sale_flag', 'createdAt', 'updatedAt')`,
            { type: QueryTypes.SELECT },
        );
        if (!defaults?.valid) throw new Error("DB_TEST_STOP: required item_draft defaults are missing");
        const [isolation] = await connection.query<{ transaction_isolation: string }>("SHOW transaction_isolation", {
            type: QueryTypes.SELECT,
        });
        if (isolation?.transaction_isolation !== "read committed")
            throw new Error("DB_TEST_STOP: READ COMMITTED required");
    }
    for (const model of models) {
        created.set(model, new Set());
        model.addHook("afterCreate", "convertedVideoTrack", (row: Model) => {
            const id: unknown = row.get("id");
            if (typeof id !== "number") throw new Error("Unexpected fixture ID");
            created.get(model)!.add(id);
        });
    }
    safe = true;
}, 30000);

beforeEach(() => {
    for (const model of models) created.set(model, new Set());
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    assertSafe();
    for (const model of models) {
        const ids = trackedIds(model);
        if (ids.length) await model.destroy({ where: { id: ids } });
    }
    for (const model of models) {
        const ids = trackedIds(model);
        if (ids.length) expect(await model.count({ where: { id: ids } })).toBe(0);
    }
}, 30000);
afterAll(async () => {
    for (const model of models) model.removeHook("afterCreate", "convertedVideoTrack");
    try {
        const results = await Promise.allSettled(connections.map((connection) => connection.close()));
        if (results.some((result) => result.status === "rejected"))
            throw new Error("Failed to close test database connections");
    } finally {
        vi.unstubAllEnvs();
    }
});

export const seed = async () => {
    assertSafe();
    const prefix = "conversion" + randomUUID().replaceAll("-", "");
    const owner = await User.create({ email: prefix + "@example.test", password: "unused-test-value" });
    const other = await User.create({ email: prefix + "other@example.test", password: "unused-test-value" });
    const old = new Date("2020-01-01T00:00:00Z");
    const originalUrl = "https://media.test/shared-source.mp4";
    const draft = await ItemDraft.create({
        seller_id: owner.id,
        name: "下書き中商品",
        detail: "動画以外は保持",
        price: 3000,
        original_url: originalUrl,
        converted_url: "https://media.test/old/index.m3u8",
        duration: 17,
        video_status: "original",
        title: "変換前の題名",
        summary: "変換前の説明",
        thumbnail_url: "https://media.test/thumbnail.png",
        first_image_url: "https://media.test/first.png",
        image_url: ["https://media.test/first.png", "https://media.test/second.png"],
        attributes: {
            inventory: { initial: 9, current: 4, low_stock_ratio: 0.5 },
            materials: [{ name: "綿", ratio: 100 }],
        },
        before_price: 4000,
        discount_rate: 25,
        discount_amount: 1000,
        sale_flag: true,
        shipping_service_free_text: "配送の備考",
        createdAt: old,
        updatedAt: old,
    });
    const sameOwnerDraft = await ItemDraft.create({
        seller_id: owner.id,
        name: "同一所有者の別下書き",
        original_url: originalUrl,
        video_status: "converted",
        duration: 67,
    });
    const otherDraft = await ItemDraft.create({
        seller_id: other.id,
        name: "別所有者の下書き",
        original_url: originalUrl,
        video_status: "processing",
        duration: 37,
    });
    const ownerlessDraft = await ItemDraft.create({
        seller_id: null,
        name: "所有者なし",
        original_url: originalUrl,
        video_status: "failed",
    });
    const protectedEditing = await ItemEditing.create({
        seller_id: owner.id,
        name: "下書き動画変換で保持する編集行",
        original_url: originalUrl,
        converted_url: "https://media.test/protected-editing/index.m3u8",
        video_status: "converted",
        duration: 87,
    });
    return { owner, other, draft, sameOwnerDraft, otherDraft, ownerlessDraft, protectedEditing, originalUrl };
};
export type DbFixture = Awaited<ReturnType<typeof seed>>;
const tables = ["item_draft", "item_editing"] as const;
export const snapshot = async (table: (typeof tables)[number], id: number, transaction?: Transaction) => {
    assertSafe();
    if (!tables.includes(table)) throw new Error("Unsupported snapshot table");
    const connection = transaction ? sequelize : observer;
    const [row] = await connection.query<Record<string, unknown>>(`SELECT * FROM "${table}" WHERE id = :id`, {
        replacements: { id },
        type: QueryTypes.SELECT,
        transaction,
    });
    return row ?? null;
};
export const protectedSnapshot = (fixture: DbFixture) =>
    Promise.all([
        snapshot("item_draft", fixture.sameOwnerDraft.id),
        snapshot("item_draft", fixture.otherDraft.id),
        snapshot("item_draft", fixture.ownerlessDraft.id),
        snapshot("item_editing", fixture.protectedEditing.id),
    ]);
