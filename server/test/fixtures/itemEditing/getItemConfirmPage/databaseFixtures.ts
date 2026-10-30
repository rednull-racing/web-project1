import { assertConnectionEnvironment } from "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic } from "sequelize";
import db, {
    ItemEditing, User, Categories, Brands, ItemConditionOption,
    ShippingDayOption, ShippingServiceOption, TodouhukenOption,
} from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";

export { ItemEditing, Categories, Brands };
assertConnectionEnvironment();
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DB_TEST_STOP: verified URL missing");
const observer = new Sequelize(url, {
    dialect: "postgres", logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});
const connections = [...new Set([sequelize, db.sequelize, observer])];
const models: ModelStatic<Model>[] = [
    ItemEditing, Categories, Brands, ItemConditionOption, ShippingDayOption,
    ShippingServiceOption, TodouhukenOption, User,
];
const created = new Map<ModelStatic<Model>, number[]>();
let safe = false;
const assertSafe = () => {
    assertConnectionEnvironment();
    if (!safe) throw new Error("DB_TEST_STOP: all guards must pass before writing");
};
beforeAll(async () => {
    assertConnectionEnvironment();
    for (const connection of connections) {
        if (connection.getDatabaseName() !== "test_db") throw new Error("DB_TEST_STOP: configured DB differs");
        const [database] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
        });
        if (database?.name !== "test_db") throw new Error("DB_TEST_STOP: actual DB differs");
        for (const model of models) {
            const columns = await connection.getQueryInterface().describeTable(model.getTableName());
            for (const [name, attribute] of Object.entries(model.getAttributes())) {
                if (!columns[name] || columns[name].allowNull !== (attribute.allowNull ?? true))
                    throw new Error(`DB_TEST_STOP: ${model.tableName}.${name} missing or NULL constraint differs`);
            }
        }
        const columns = await connection.getQueryInterface().describeTable("item_editing");
        for (const name of ["id", "item_id", "seller_id", "price", "duration", "before_price", "discount_rate", "discount_amount"]) {
            if (columns[name].type.toUpperCase() !== "INTEGER")
                throw new Error(`DB_TEST_STOP: item_editing.${name} must be INTEGER`);
        }
        if (columns.attributes.type.toUpperCase() !== "JSONB" || columns.image_url.type.toUpperCase() !== "ARRAY")
            throw new Error("DB_TEST_STOP: JSONB/array schema differs");
        const fks = await connection.query<{ column_name: string; referenced_table: string; referenced_column: string }>(
            `SELECT key.column_name, target.table_name AS referenced_table, target.column_name AS referenced_column
             FROM information_schema.table_constraints constraint_row
             JOIN information_schema.key_column_usage key USING (constraint_catalog, constraint_schema, constraint_name)
             JOIN information_schema.constraint_column_usage target USING (constraint_catalog, constraint_schema, constraint_name)
             WHERE constraint_row.constraint_type = 'FOREIGN KEY'
             AND constraint_row.table_schema = 'public' AND constraint_row.table_name = 'item_editing'`,
            { type: QueryTypes.SELECT },
        );
        for (const [column, table] of Object.entries({ seller_id: "user", category_id: "categories", brand_id: "brands",
            item_condition_id: "item_condition_option", shipping_day_id: "shipping_day_option",
            shipping_service_id: "shipping_service_option", shipping_place_id: "todouhuken_option" })) {
            if (!fks.some((fk) => fk.column_name === column && fk.referenced_table === table && fk.referenced_column === "id"))
                throw new Error(`DB_TEST_STOP: owner/related FK ${column} missing`);
        }
    }
    for (const model of models) {
        created.set(model, []);
        model.addHook("afterCreate", "confirmPageTrack", (row: Model) => {
            const id: unknown = row.get("id");
            if (typeof id !== "number") throw new Error("Unexpected fixture ID");
            created.get(model)!.push(id);
        });
    }
    safe = true;
}, 30000);
beforeEach(() => { for (const model of models) created.set(model, []); });
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    assertSafe();
    // Categoryは自己参照FKを持つため、子から親の作成逆順で削除する。
    for (const model of models) {
        const ids = created.get(model)!;
        for (const id of [...ids].reverse()) await model.destroy({ where: { id } });
        if (ids.length) expect(await model.count({ where: { id: ids } })).toBe(0);
    }
}, 30000);
afterAll(async () => {
    for (const model of models) model.removeHook("afterCreate", "confirmPageTrack");
    try {
        const results = await Promise.allSettled(connections.map((connection) => connection.close()));
        if (results.some((result) => result.status === "rejected")) throw new Error("DB connection close failed");
    } finally { vi.unstubAllEnvs(); }
});
export const seed = async () => {
    assertSafe();
    const prefix = "confirm" + randomUUID().replaceAll("-", "");
    const owner = await User.create({ email: prefix + "@example.test", password: "unused-test-value" });
    const other = await User.create({ email: prefix + "other@example.test", password: "unused-test-value" });
    const parent = await Categories.create({ name: "親", level: 1, path: prefix, layer: "middle" });
    const category = await Categories.create({ name: "カテゴリー", level: 2, path: prefix + "category", parent_id: parent.id, layer: "middle" });
    const child = await Categories.create({ name: "子", level: 3, path: prefix + "child", parent_id: category.id, layer: "middle" });
    const brand = await Brands.create({ name: prefix, name_normalized: prefix });
    const condition = await ItemConditionOption.create({ name: "新品" });
    const day = await ShippingDayOption.create({ name: "翌日" });
    const service = await ShippingServiceOption.create({ name: "配送" });
    const place = await TodouhukenOption.create({ name: "東京都" });
    const timestamp = new Date("2026-01-02T03:04:05Z");
    const editing = await ItemEditing.create({
        seller_id: owner.id, status: "normal", item_id: null, name: "確認商品", detail: "説明", price: 3000,
        image_url: ["https://media.test/first.jpg", "https://media.test/second.jpg"],
        first_image_url: "https://media.test/first.jpg", gender_type: "unisex", age_type: "both", recommend: true,
        attributes: { inventory: { initial: 5, current: 2, low_stock_ratio: 0.5 }, materials: [{ name: "綿", ratio: 100 }] },
        thumbnail_url: "https://media.test/thumb.jpg", title: "題名", summary: "要約", duration: 17,
        original_url: "https://media.test/original.mp4", converted_url: "https://media.test/index.m3u8",
        before_price: 4000, discount_rate: 25, discount_amount: 1000, sale_flag: true,
        shipping_service_free_text: "配送備考", category_id: category.id, brand_id: brand.id,
        item_condition_id: condition.id, shipping_day_id: day.id, shipping_service_id: service.id, shipping_place_id: place.id,
        video_status: "converted", createdAt: timestamp, updatedAt: timestamp,
    });
    const empty = await ItemEditing.create({ seller_id: owner.id, status: "edit", recommend: null });
    const otherEditing = await ItemEditing.create({ seller_id: other.id, name: "別所有者" });
    const ownerless = await ItemEditing.create({ seller_id: null, name: "所有者なし" });
    const deleted = await ItemEditing.create({ seller_id: owner.id });
    const missingId = deleted.id;
    await deleted.destroy();
    return { owner, other, parent, category, child, brand, condition, day, service, place, editing, empty, otherEditing, ownerless, missingId };
};
export type Fixture = Awaited<ReturnType<typeof seed>>;
export const snapshot = async () => {
    assertSafe();
    return Promise.all(models.map(async (model) => {
        const ids = created.get(model)!;
        if (!ids.length) return [];
        return observer.query<Record<string, unknown>>(`SELECT * FROM "${model.tableName}" WHERE id IN (:ids) ORDER BY id`, {
            replacements: { ids }, type: QueryTypes.SELECT,
        });
    }));
};

export const savedUpdatedAt = async (itemEditingId: number) => {
    assertSafe();
    const [row] = await observer.query<{ updatedAt: Date }>('SELECT "updatedAt" FROM item_editing WHERE id = :id', {
        replacements: { id: itemEditingId }, type: QueryTypes.SELECT,
    });
    if (!(row?.updatedAt instanceof Date)) throw new Error("Expected saved timestamp for fixture row");
    return row.updatedAt;
};
