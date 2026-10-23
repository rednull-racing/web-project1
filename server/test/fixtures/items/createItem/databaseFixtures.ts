import "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic, Transaction } from "sequelize";
import db from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";
import { makeEditing, makeAttributes } from "./fixtures.js";
import { createItemUseCase } from "../../../../src/usecases/items/create/createItem.js";
export const {
    ItemEditing,
    Item,
    ItemDraft,
    Video,
    Sale,
    ItemShippingProfile,
    User,
    Categories,
    Brands,
    BrandAliases,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
    Follow,
} = db;
const notification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("../../../../src/services/notification/notification.js", () => ({ createNotification: notification }));
export { notification };
export const observer = new Sequelize(process.env.DATABASE_URL!, {
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});
const models: ModelStatic<Model>[] = [
    ItemEditing,
    ItemDraft,
    Item,
    Video,
    Sale,
    ItemShippingProfile,
    Follow,
    BrandAliases,
    Brands,
    Categories,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
    User,
];
const created = new Map<ModelStatic<Model>, number[]>();
let safe = false;
export const ids = (model: ModelStatic<Model>) => created.get(model) ?? [];
beforeAll(async () => {
    for (const connection of [sequelize, db.sequelize, observer] as Sequelize[]) {
        if (connection.getDatabaseName() !== "test_db")
            throw new Error("DB_TEST_STOP: configured database is not test_db");
        const [row] = await connection.query<{
            name: string;
        }>("SELECT current_database() AS name", { type: QueryTypes.SELECT });
        if (row.name !== "test_db") throw new Error("DB_TEST_STOP: actual database is not test_db");
        const [isolation] = await connection.query<{ transaction_isolation: string }>("SHOW transaction_isolation", {
            type: QueryTypes.SELECT,
        });
        if (isolation.transaction_isolation !== "read committed")
            throw new Error("DB_TEST_STOP: concurrency tests require READ COMMITTED");
    }
    // 旧カラムが残る環境をテスト側で自動補正しない。
    const columns = await observer.query<{
        table_name: string;
        column_name: string;
    }>(
        "SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('item','item_editing','item_draft','video','sale','item_shipping_profile')",
        { type: QueryTypes.SELECT },
    );
    for (const [table, column] of [
        ["item", "deleted_at"],
        ["item_editing", "item_id"],
        ["item_draft", "item_id"],
        ["video", "item_id"],
        ["video", "user_id"],
        ["sale", "item_id"],
        ["item_shipping_profile", "item_id"],
    ]) {
        if (columns.some((c) => c.table_name === table && c.column_name === column))
            throw new Error(`DB_TEST_SCHEMA_MISMATCH: ${table}.${column} remains`);
    }
    safe = true;
    for (const model of models)
        model.addHook("afterCreate", "createItemTrack", (row: Model) => {
            created.get(model)!.push(row.get("id") as number);
        });
});
beforeEach(() => {
    for (const model of models) created.set(model, []);
    notification.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    for (const model of models) {
        const own = ids(model);
        if (own.length) await model.destroy({ where: { id: own } });
    }
    for (const model of models) {
        const own = ids(model);
        if (own.length) expect(await model.count({ where: { id: own } })).toBe(0);
    }
});
afterAll(async () => {
    for (const model of models) model.removeHook("afterCreate", "createItemTrack");
    await Promise.all([sequelize.close(), (db.sequelize as Sequelize).close(), observer.close()]);
    vi.unstubAllEnvs();
});
export const seed = async () => {
    if (!safe) throw new Error("DB_TEST_STOP: unverified database");
    const prefix = `ci${randomUUID().replaceAll("-", "")}`;
    const owner = await User.create({
        email: `${prefix}@example.test`,
        password: "unused",
        user_name: " ＵＳＥＲ ",
        user_introduction: "紹介DE",
        penalty_points: 5,
    });
    const other = await User.create({ email: `${prefix}b@example.test`, password: "unused" });
    const parent = await Categories.create({
        name: " ＴＯＰＳ ",
        level: 1,
        path: prefix,
        body_category: "top",
        lifestyle_category: "casual",
        layer: "middle",
    });
    const category = await Categories.create({
        name: " シャツ ",
        parent_id: parent.id,
        level: 2,
        path: `${prefix}/child`,
        body_category: "top",
        lifestyle_category: "casual",
        layer: "middle",
    });
    const condition = await ItemConditionOption.create({ name: "新品" });
    const day = await ShippingDayOption.create({ name: "翌日" });
    const service = await ShippingServiceOption.create({ name: "配送" });
    const place = await TodouhukenOption.create({ name: "東京都" });
    const brand = await Brands.create({ name: prefix, name_normalized: prefix });
    const alias = await BrandAliases.create({ brand_id: brand.id, name: prefix, name_normalized: prefix });
    const { id: _id, createdAt: _created, updatedAt: _updated, ...base } = makeEditing();
    void _id;
    void _created;
    void _updated;
    const data = {
        ...base,
        seller_id: owner.id,
        category_id: category.id,
        item_condition_id: condition.id,
        shipping_day_id: day.id,
        shipping_service_id: service.id,
        shipping_place_id: place.id,
        brand_id: brand.id,
        brand_aliases_id: alias.id,
        attributes: makeAttributes(),
    };
    const editing = await ItemEditing.create(data);
    const otherEditing = await ItemEditing.create({ ...data, seller_id: other.id, name: "別所有者" });
    const ownEditing = await ItemEditing.create({ ...data, name: "別セッション" });
    const draft = await ItemDraft.create({ seller_id: owner.id, name: "保護下書き" });
    const video = await Video.create({ title: "保護動画" });
    const sale = await Sale.create({ before_price: 999 });
    const shipping = await ItemShippingProfile.create({});
    const existing = await Item.create({
        seller_id: owner.id,
        name: "保護商品",
        price: 999,
        video_id: video.id,
        sale_id: sale.id,
        shipping_id: shipping.id,
        uploaded_at: new Date(),
        status: "soldout",
    });
    const protectedRows = await Promise.all(
        [
            ["item", existing.id],
            ["video", video.id],
            ["sale", sale.id],
            ["item_shipping_profile", shipping.id],
            ["item_editing", otherEditing.id],
            ["item_editing", ownEditing.id],
            ["item_draft", draft.id],
        ].map(async ([table, id]) => ({
            table: String(table),
            id: Number(id),
            value: await snapshot(String(table), Number(id)),
        })),
    );
    return { owner, other, editing, otherEditing, ownEditing, draft, existing, category, brand, alias, protectedRows };
};
export type Fixture = Awaited<ReturnType<typeof seed>>;
export const run = (f: Fixture, id = f.editing.id, userId = f.owner.id) =>
    createItemUseCase({ userId, itemEditingId: id });
export const snapshot = async (table: string, id: number, transaction?: Transaction) => {
    if (!["item", "video", "sale", "item_shipping_profile", "item_editing", "item_draft"].includes(table))
        throw new Error("invalid snapshot table");
    return (
        (
            await (transaction ? sequelize : observer).query<Record<string, unknown>>(
                `SELECT * FROM "${table}" WHERE id=:id`,
                { replacements: { id }, type: QueryTypes.SELECT, ...(transaction ? { transaction } : {}) },
            )
        )[0] ?? null
    );
};
export const assertProtected = async (f: Fixture) => {
    for (const row of f.protectedRows) expect(await snapshot(row.table, row.id)).toEqual(row.value);
};
export const assertRolledBack = async (f: Fixture, before: unknown) => {
    expect(await snapshot("item_editing", f.editing.id)).toEqual(before);
    for (const [model, table] of [
        [Item, "item"],
        [Video, "video"],
        [Sale, "sale"],
        [ItemShippingProfile, "item_shipping_profile"],
    ] as const) {
        const protectedIds = f.protectedRows.filter((r) => r.table === table).map((r) => r.id);
        for (const id of ids(model).filter((id) => !protectedIds.includes(id)))
            expect(await snapshot(table, id)).toBeNull();
    }
    await observer.transaction(async (t) => {
        await observer.query("SELECT id FROM item_editing WHERE id=:id FOR UPDATE NOWAIT", {
            replacements: { id: f.editing.id },
            transaction: t,
        });
    });
    await assertProtected(f);
    expect(notification).not.toHaveBeenCalled();
};

export const assertPublishedCount = async (f: Fixture, expected: number) => {
    for (const [model, table] of [
        [Item, "item"],
        [Video, "video"],
        [Sale, "sale"],
        [ItemShippingProfile, "item_shipping_profile"],
    ] as const) {
        const protectedIds = f.protectedRows.filter((row) => row.table === table).map((row) => row.id);
        const rows = await Promise.all(
            ids(model)
                .filter((id) => !protectedIds.includes(id))
                .map((id) => snapshot(table, id)),
        );
        expect(
            rows.filter((row) => row !== null),
            table,
        ).toHaveLength(expected);
    }
};
export const assertPublishedRelations = async (itemId: number) => {
    const item = await snapshot("item", itemId);
    expect(item).not.toBeNull();
    for (const [table, key] of [
        ["video", "video_id"],
        ["sale", "sale_id"],
        ["item_shipping_profile", "shipping_id"],
    ]) {
        expect(await snapshot(table, Number(item![key])), table).not.toBeNull();
    }
};
