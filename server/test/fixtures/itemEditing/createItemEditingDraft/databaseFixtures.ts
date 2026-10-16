import { assertEnvironment } from "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic, Transaction } from "sequelize";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import db from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";
import ItemDraft from "../../../../src/models/item_draft.js";
import ItemEditing from "../../../../src/models/item_editing.js";
import Item from "../../../../src/models/item.js";
import User from "../../../../src/models/user.js";
import Categories from "../../../../src/models/categories.js";
import Brands from "../../../../src/models/brands.js";
import BrandAliases from "../../../../src/models/brand_aliases.js";
import ItemConditionOption from "../../../../src/models/item_condition_option.js";
import ShippingDayOption from "../../../../src/models/shipping_day_option.js";
import ShippingServiceOption from "../../../../src/models/shipping_service_option.js";
import TodouhukenOption from "../../../../src/models/todouhuken_option.js";
import { createItemEditingDraftUseCase } from "../../../../src/usecases/itemEditing/createItemEditingDraft.js";
import { copyColumns, makeData } from "../../../../src/usecases/itemEditing/test/createItemEditingDraft.fixtures.js";
import type { CopyData } from "../../../../src/usecases/itemEditing/test/createItemEditingDraft.fixtures.js";

export { sequelize, ItemDraft, ItemEditing, Item, User, Brands, BrandAliases };
assertEnvironment();
const connectionOptions = {
    dialect: "postgres" as const,
    logging: false as const,
    pool: { max: 5, min: 0, acquire: 10000 },
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
};
export const observer = new Sequelize(process.env.DATABASE_URL!, connectionOptions);
export const competitor = new Sequelize(process.env.DATABASE_URL!, connectionOptions);
const connections: Sequelize[] = [sequelize, db.sequelize, observer, competitor];
const cleanupModels: ModelStatic<Model>[] = [
    ItemEditing,
    ItemDraft,
    Item,
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

const checkSchema = async () => {
    for (const model of [ItemDraft, ItemEditing]) {
        const table = model.getTableName();
        const rows = await observer.query<{
            column_name: string;
            is_nullable: string;
            data_type: string;
            udt_name: string;
            character_maximum_length: number | null;
        }>(
            `SELECT column_name, is_nullable, data_type, udt_name, character_maximum_length
             FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=:table`,
            { replacements: { table }, type: QueryTypes.SELECT },
        );
        const columns = new Map(rows.map((row) => [row.column_name, row]));
        for (const [name, attribute] of Object.entries(model.getAttributes())) {
            const column = columns.get(name);
            if (
                !column ||
                (attribute.allowNull === false && column.is_nullable !== "NO") ||
                (attribute.allowNull === true && column.is_nullable !== "YES")
            ) {
                throw new Error(`DB_TEST_STOP: schema mismatch ${table}.${name}`);
            }
            const type = String(attribute.type);
            if (type.startsWith("VARCHAR") && column.character_maximum_length !== 255)
                throw new Error(`DB_TEST_STOP: length mismatch ${table}.${name}`);
            if (type === "INTEGER" && column.data_type !== "integer")
                throw new Error(`DB_TEST_STOP: integer mismatch ${table}.${name}`);
            if (type === "BOOLEAN" && column.data_type !== "boolean")
                throw new Error(`DB_TEST_STOP: boolean mismatch ${table}.${name}`);
            if (type === "JSONB" && column.udt_name !== "jsonb")
                throw new Error(`DB_TEST_STOP: JSONB mismatch ${table}.${name}`);
            if (name === "image_url" && column.udt_name !== "_text")
                throw new Error(`DB_TEST_STOP: array mismatch ${table}.${name}`);
        }
        for (const [column, values] of [
            ["gender_type", ["men", "women", "unisex"]],
            ["age_type", ["adult", "kids", "both"]],
        ] as const) {
            const result = await observer.query<{ enumlabel: string }>(
                `SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid
                 JOIN pg_namespace n ON n.oid=t.typnamespace
                 WHERE t.typname=:type AND n.nspname=current_schema() ORDER BY e.enumsortorder`,
                { replacements: { type: columns.get(column)?.udt_name }, type: QueryTypes.SELECT },
            );
            expect(result.map((row) => row.enumlabel)).toEqual(values);
        }
        const fks = await observer.query<{
            column_name: string;
            target: string;
            target_column: string;
            delete_action: string;
            update_action: string;
        }>(
            `SELECT a.attname AS column_name, target.relname AS target, b.attname AS target_column,
                    c.confdeltype AS delete_action, c.confupdtype AS update_action
             FROM pg_constraint c JOIN pg_class source ON source.oid=c.conrelid
             JOIN pg_namespace n ON n.oid=source.relnamespace JOIN pg_class target ON target.oid=c.confrelid
             JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
             JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
             WHERE c.contype='f' AND source.relname=:table AND n.nspname=current_schema()`,
            { replacements: { table }, type: QueryTypes.SELECT },
        );
        const targets = {
            item_id: "item",
            seller_id: "user",
            item_condition_id: "item_condition_option",
            category_id: "categories",
            brand_id: "brands",
            brand_aliases_id: "brand_aliases",
            shipping_day_id: "shipping_day_option",
            shipping_service_id: "shipping_service_option",
            shipping_place_id: "todouhuken_option",
        };
        for (const [column, target] of Object.entries(targets)) {
            expect(fks.find((fk) => fk.column_name === column)).toEqual({
                column_name: column,
                target,
                target_column: "id",
                update_action: "a",
                delete_action: column === "item_id" ? "c" : column.startsWith("brand") ? "n" : "a",
            });
        }
    }
};

beforeAll(async () => {
    assertEnvironment();
    // 接続前に全設定を検査し、どの接続でも確認完了前に書き込まない。
    for (const connection of connections) {
        if (connection.getDatabaseName() !== "test_db")
            throw new Error("DB_TEST_STOP: Sequelize database is not test_db; user decision required");
    }
    for (const connection of connections) {
        const [row] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
        });
        if (row.name !== "test_db")
            throw new Error("DB_TEST_STOP: actual database is not test_db; user decision required");
    }
    await checkSchema();
    safe = true;
    for (const model of cleanupModels) {
        created.set(model, []);
        model.addHook("afterCreate", "createItemEditingDraftTrack", (row: Model) => {
            created.get(model)!.push(Number(row.get("id")));
        });
    }
});
beforeEach(() => {
    assertEnvironment();
    for (const model of cleanupModels) created.set(model, []);
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    assertEnvironment();
    for (const model of cleanupModels) {
        const ids = created.get(model) ?? [];
        if (ids.length) await model.destroy({ where: { id: ids } });
    }
    for (const model of cleanupModels) {
        const ids = created.get(model) ?? [];
        if (ids.length) expect(await model.count({ where: { id: ids } })).toBe(0);
    }
});
afterAll(async () => {
    for (const model of cleanupModels) model.removeHook("afterCreate", "createItemEditingDraftTrack");
    await Promise.all(connections.map((connection) => connection.close()));
    vi.unstubAllEnvs();
});

export const seed = async () => {
    assertEnvironment();
    if (!safe) throw new Error("DB_TEST_STOP: database has not been verified");
    const prefix = `draft${randomUUID().replaceAll("-", "")}`;
    const owner = await User.create({ email: `${prefix}@example.test`, password: "unused-test-value" });
    const other = await User.create({ email: `${prefix}other@example.test`, password: "unused-test-value" });
    const category = await Categories.create({
        name: prefix,
        path: prefix,
        level: 1,
        body_category: "top",
        lifestyle_category: "casual",
        layer: "middle",
    });
    const condition = await ItemConditionOption.create({ name: `${prefix}状態` });
    const day = await ShippingDayOption.create({ name: `${prefix}翌日` });
    const service = await ShippingServiceOption.create({ name: `${prefix}配送` });
    const place = await TodouhukenOption.create({ name: prefix.slice(0, 20) });
    const brand = await Brands.create({ name: prefix, name_normalized: prefix });
    const alias = await BrandAliases.create({
        brand_id: brand.id,
        name: `${prefix}alias`,
        name_normalized: `${prefix}alias`,
    });
    const item = await Item.create({
        seller_id: owner.id,
        name: "公開商品",
        price: 900,
        uploaded_at: new Date("2020-01-01T00:00:00Z"),
    });
    const values = makeData({
        seller_id: owner.id,
        item_id: item.id,
        category_id: category.id,
        item_condition_id: condition.id,
        brand_id: brand.id,
        brand_aliases_id: alias.id,
        shipping_day_id: day.id,
        shipping_service_id: service.id,
        shipping_place_id: place.id,
    });
    const draft = await ItemDraft.create({
        ...values,
        createdAt: new Date("2020-01-01T00:00:00Z"),
        updatedAt: new Date("2020-01-02T00:00:00Z"),
    });
    const otherDraft = await ItemDraft.create({
        ...values,
        seller_id: other.id,
        item_id: null,
        name: "他人の商品",
        price: 2000,
        attributes: { inventory: { initial: 7, current: 3, low_stock_ratio: 0.2 } },
    });
    const sameOwnerDraft = await ItemDraft.create({ seller_id: owner.id, name: "所有者の別下書き" });
    const editing = await ItemEditing.create({ seller_id: owner.id, item_id: item.id, name: "既存編集" });
    return {
        prefix,
        owner,
        other,
        category,
        condition,
        day,
        service,
        place,
        brand,
        alias,
        item,
        values,
        draft,
        otherDraft,
        sameOwnerDraft,
        editing,
    };
};
export type DbFixture = Awaited<ReturnType<typeof seed>>;
export const run = (f: DbFixture, itemDraftId = f.draft.id, userId = f.owner.id) =>
    createItemEditingDraftUseCase({ itemDraftId, userId });
export type Table =
    | "item_draft"
    | "item_editing"
    | "item"
    | "user"
    | "categories"
    | "brands"
    | "brand_aliases"
    | "item_condition_option"
    | "shipping_day_option"
    | "shipping_service_option"
    | "todouhuken_option";
export const snapshot = async (table: Table, id: number, transaction?: Transaction) => {
    const rows = await (transaction ? sequelize : observer).query<Record<string, unknown>>(
        `SELECT * FROM "${table}" WHERE id=:id`,
        { replacements: { id }, transaction, type: QueryTypes.SELECT },
    );
    return rows[0] ?? null;
};
export const editingIds = () => created.get(ItemEditing) ?? [];
export const savedEditings = async (f: DbFixture) =>
    observer.query<Record<string, unknown>>(
        "SELECT * FROM item_editing WHERE seller_id IN (:owners) AND id<>:existing ORDER BY id",
        { replacements: { owners: [f.owner.id, f.other.id], existing: f.editing.id }, type: QueryTypes.SELECT },
    );
export const protectedRows = async (f: DbFixture, excludedDraftIds: readonly number[] = []) =>
    Promise.all([
        ...[f.sameOwnerDraft, f.otherDraft]
            .filter((draft) => !excludedDraftIds.includes(draft.id))
            .map((draft) => snapshot("item_draft", draft.id)),
        snapshot("item_editing", f.editing.id),
        snapshot("item", f.item.id),
        snapshot("categories", f.category.id),
        snapshot("brands", f.brand.id),
        snapshot("brand_aliases", f.alias.id),
        snapshot("item_condition_option", f.condition.id),
        snapshot("shipping_day_option", f.day.id),
        snapshot("shipping_service_option", f.service.id),
        snapshot("todouhuken_option", f.place.id),
        snapshot("user", f.owner.id),
        snapshot("user", f.other.id),
    ]);
export const expectCopied = (
    saved: Record<string, unknown> | null,
    original: Record<string, unknown>,
    owner: number,
) => {
    expect(saved).not.toBeNull();
    for (const column of copyColumns) expect(saved![column], column).toEqual(original[column]);
    expect(saved!.seller_id).toBe(owner);
};
export const replaceDraft = async (f: DbFixture, values: Partial<CopyData>) => {
    await f.draft.update(values);
};
export const expectUnchanged = async (
    f: DbFixture,
    original: Record<string, unknown>,
    protectedBefore: Awaited<ReturnType<typeof protectedRows>>,
) => {
    expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
    expect(await savedEditings(f)).toEqual([]);
    expect(await protectedRows(f)).toEqual(protectedBefore);
};
export const expectLockReleased = async (id: number) =>
    competitor.transaction(async (transaction) => {
        const rows = await competitor.query<{ id: number }>(
            "SELECT id FROM item_draft WHERE id=:id FOR UPDATE NOWAIT",
            { replacements: { id }, type: QueryTypes.SELECT, transaction },
        );
        expect(rows.map((row) => row.id)).toEqual([id]);
    });
