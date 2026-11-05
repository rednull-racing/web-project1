import "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { Op, QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic, Transaction } from "sequelize";
import db from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";
import {
    Item,
    ItemEditing,
    ItemTrash,
    Orders,
    PurchaseSession,
    ItemReport,
    ItemReportOption,
    Address,
    Name,
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
} from "../../../../src/models/index.js";
import { createItemTrashUseCase } from "../../../../src/usecases/itemTrash/createItemTrash.js";
import { makeItem } from "../../itemEditing/createItemEditingCopy/fixtures.js";
import { notification } from "./databaseSetup.js";
export { notification };

export {
    sequelize,
    Item,
    ItemEditing,
    ItemTrash,
    Orders,
    PurchaseSession,
    ItemReport,
    ItemReportOption,
    Address,
    Name,
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
};
const url = process.env.DATABASE_URL;
if (!url || new URL(url).pathname !== "/test_db" || process.env.NODE_ENV !== "test") {
    throw new Error("DB_TEST_STOP: invalid observer configuration; user decision required");
}
export const observer = new Sequelize(url, {
    dialect: "postgres",
    logging: false,
    pool: { max: 5, min: 0 },
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});
const cleanupModels: ModelStatic<Model>[] = [
    ItemEditing,
    ItemTrash,
    Orders,
    PurchaseSession,
    ItemReport,
    ItemReportOption,
    Address,
    Name,
    Item,
    Video,
    Sale,
    ItemShippingProfile,
    BrandAliases,
    Brands,
    Categories,
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
    User,
];
const created = new Map<ModelStatic<Model>, Set<number>>();
let safe = false;
export const trackedIds = (model: ModelStatic<Model>) => [...(created.get(model) ?? [])];
export const assertEnvironment = () => {
    if (!safe) throw new Error("DB_TEST_STOP: all database guards must pass before writing");
};
beforeAll(async () => {
    for (const connection of [sequelize, db.sequelize, observer]) {
        if (connection.getDatabaseName() !== "test_db") {
            throw new Error("DB_TEST_STOP: configured database is not test_db; user decision required");
        }
        const [row] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT,
            logging: false,
        });
        if (row?.name !== "test_db") {
            throw new Error("DB_TEST_STOP: actual database is not test_db; user decision required");
        }
    }
    const qi = sequelize.getQueryInterface();
    for (const model of cleanupModels) await qi.describeTable(model.getTableName());
    const columns = await qi.describeTable("item_trash");
    for (const model of cleanupModels) {
        const columns = await qi.describeTable(model.getTableName());
        for (const [key, definition] of Object.entries(model.getAttributes())) {
            if (!columns[key] || columns[key].allowNull !== (definition.allowNull !== false && !definition.primaryKey)) {
                throw new Error("DB_TEST_STOP: model columns/NULL differ: " + model.getTableName() + "." + key);
            }
        }
    }
    for (const [table, action] of [["orders", "n"], ["purchase_session", "n"], ["item_editing", "n"], ["item_report", "a"]]) {
        const [row] = await sequelize.query<{ ok: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
             JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=ANY(c.conkey)
             WHERE t.relname=:table AND a.attname='item_id' AND c.contype='f'
             AND c.confrelid='item'::regclass AND c.confdeltype=:action) AS ok`,
            { replacements: { table, action }, type: QueryTypes.SELECT },
        );
        if (!row.ok) throw new Error("DB_TEST_STOP: item_id FK differs: " + table);
    }
    const [trashFk] = await sequelize.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
         WHERE c.conrelid='item_trash'::regclass AND c.contype='f' AND a.attname='item_id'`,
        { type: QueryTypes.SELECT },
    );
    if (trashFk.count !== 0 || !columns.item_id.allowNull) throw new Error("DB_TEST_STOP: item_trash must retain historical item_id without FK");
    const [isolation] = await sequelize.query<{ transaction_isolation: string }>("SHOW transaction_isolation", {
        type: QueryTypes.SELECT,
    });
    if (isolation.transaction_isolation !== "read committed") {
        throw new Error("DB_TEST_STOP: concurrency cases require READ COMMITTED");
    }
    safe = true;
    for (const model of cleanupModels) {
        model.addHook("afterCreate", "trashTrack", (row: Model) => {
            const id: unknown = row.get("id");
            if (typeof id !== "number") throw new Error("Unexpected fixture primary key");
            created.get(model)!.add(id);
        });
    }
}, 30000);
beforeEach(() => {
    for (const model of cleanupModels) created.set(model, new Set());
    notification.mockReset();
    notification.mockResolvedValue(undefined);
});
afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    for (const model of cleanupModels) {
        const ids = trackedIds(model);
        if (ids.length) await model.destroy({ where: { id: { [Op.in]: ids } } });
    }
    for (const model of cleanupModels) {
        const ids = trackedIds(model);
        if (ids.length) expect(await model.count({ where: { id: { [Op.in]: ids } } })).toBe(0);
    }
}, 30000);
afterAll(async () => {
    for (const model of cleanupModels) model.removeHook("afterCreate", "trashTrack");
    try {
        const closed = await Promise.allSettled([sequelize.close(), db.sequelize.close(), observer.close()]);
        const errors = closed.filter((result) => result.status === "rejected");
        if (errors.length) throw new Error("Failed to close one or more test database connections");
    } finally {
        vi.unstubAllEnvs();
    }
});

export const seed = async () => {
    assertEnvironment();
    const prefix = "trash" + randomUUID().replaceAll("-", "");
    const owner = await User.create({ email: prefix + "@example.test", password: "unused-test-value" });
    const other = await User.create({ email: prefix + "-other@example.test", password: "unused-test-value" });
    const category = await Categories.create({
        name: prefix,
        level: 1,
        path: prefix,
        body_category: "top",
        lifestyle_category: "casual",
        layer: "middle",
    });
    const brand = await Brands.create({ name: prefix, name_normalized: prefix });
    const alias = await BrandAliases.create({
        brand_id: brand.id,
        name: prefix + "alias",
        name_normalized: prefix + "alias",
    });
    const condition = await ItemConditionOption.create({ name: "新品" });
    const day = await ShippingDayOption.create({ name: "翌日" });
    const service = await ShippingServiceOption.create({ name: "テスト配送" });
    const place = await TodouhukenOption.create({ name: "東京都" });
    const createCatalog = async (sellerId: number, isOther: boolean) => {
        const source = makeItem();
        const old = new Date("2020-01-01T00:00:00Z");
        const video = await Video.create({
            ...source.Video!,
            title: isOther ? "別動画" : source.Video!.title,
            createdAt: old,
            updatedAt: old,
        });
        const sale = await Sale.create({
            ...source.Sale!,
            before_price: isOther ? 23000 : 10000,
            createdAt: old,
            updatedAt: old,
        });
        const shipping = await ItemShippingProfile.create({
            shipping_day_id: day.id,
            shipping_service_id: service.id,
            shipping_place_id: place.id,
            shipping_service_free_text: isOther ? "別配送" : "配送備考",
            createdAt: old,
            updatedAt: old,
        });
        const item = await Item.create({
            name: isOther ? "別商品" : source.name,
            detail: source.detail,
            image_url: source.image_url,
            price: isOther ? 21000 : source.price,
            item_condition_id: condition.id,
            seller_id: sellerId,
            first_image_url: source.first_image_url,
            gender_type: source.gender_type,
            age_type: source.age_type,
            recommend: source.recommend,
            category_id: category.id,
            brand_id: brand.id,
            brand_aliases_id: alias.id,
            attributes: source.attributes,
            video_id: video.id,
            sale_id: sale.id,
            shipping_id: shipping.id,
            status: "active",
            uploaded_at: old,
            createdAt: old,
            updatedAt: old,
        });
        return { item, video, sale, shipping };
    };
    const catalog = await createCatalog(owner.id, false);
    const otherCatalog = await createCatalog(other.id, true);
    const existing = await ItemEditing.create({
        seller_id: owner.id,
        item_id: catalog.item.id,
        name: "既存編集",
        price: 555,
    });
    const otherEditing = await ItemEditing.create({
        seller_id: other.id,
        item_id: otherCatalog.item.id,
        name: "別編集",
        price: 777,
    });
    return {
        prefix,
        owner,
        other,
        category,
        brand,
        alias,
        condition,
        day,
        service,
        place,
        ...catalog,
        otherItem: otherCatalog.item,
        otherVideo: otherCatalog.video,
        otherSale: otherCatalog.sale,
        otherShipping: otherCatalog.shipping,
        existing,
        otherEditing,
    };
};
export type DbFixture = Awaited<ReturnType<typeof seed>>;
export const run = (f: DbFixture, itemId = f.item.id, userId = f.owner.id) =>
    createItemTrashUseCase({ itemId, userId });
const tables = ["item", "item_trash", "item_editing", "video", "sale", "item_shipping_profile", "item_report", "orders", "purchase_session"] as const;
export type SnapshotTable = (typeof tables)[number];
export const snapshot = async (table: SnapshotTable, id: number, transaction?: Transaction) => {
    if (!tables.includes(table)) throw new Error("Unsupported snapshot table");
    const [row] = await observer.query<Record<string, unknown>>('SELECT * FROM "' + table + '" WHERE id = :id', {
        replacements: { id }, type: QueryTypes.SELECT, transaction,
    });
    return row ?? null;
};
export const trashRows = (f: DbFixture) => observer.query<Record<string, unknown>>(
    'SELECT * FROM item_trash WHERE seller_id IN (:owners) ORDER BY id',
    { replacements: { owners: [f.owner.id, f.other.id] }, type: QueryTypes.SELECT },
);
export const protectedSnapshot = (f: DbFixture) => Promise.all([
    snapshot("item", f.otherItem.id), snapshot("video", f.otherVideo.id),
    snapshot("sale", f.otherSale.id), snapshot("item_shipping_profile", f.otherShipping.id),
    snapshot("item_editing", f.otherEditing.id),
]);
export const sourceSnapshot = (f: DbFixture) => Promise.all([
    snapshot("item", f.item.id), snapshot("video", f.video.id), snapshot("sale", f.sale.id),
    snapshot("item_shipping_profile", f.shipping.id), snapshot("item_editing", f.existing.id),
]);
export const seedDependents = async (f: DbFixture) => {
    assertEnvironment();
    const address = await Address.create({ shikutyouson: "テスト市" });
    const name = await Name.create({ sei: "テスト", mei: "購入者", shop_type: "contact" });
    const order = await Orders.create({ item_id: f.item.id, seller_user_id: f.owner.id, buyer_user_id: f.other.id, unit_price: 1234 });
    const session = await PurchaseSession.create({
        item_id: f.item.id, buyer_user_id: f.other.id, address_id: address.id, name_id: name.id,
        selected_variant: { color: "赤" }, expires_at: new Date("2099-01-01T00:00:00Z"),
    });
    const option = await ItemReportOption.create({ name: "テスト通報" });
    const report = await ItemReport.create({ item_id: f.item.id, report_user_id: f.other.id, option_id: option.id });
    const otherReport = await ItemReport.create({ item_id: f.otherItem.id, report_user_id: f.owner.id, option_id: option.id });
    return { order, session, report, otherReport };
};
