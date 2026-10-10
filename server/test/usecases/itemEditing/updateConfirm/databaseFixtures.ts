import "./databaseSetup.js";
import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, expect, vi } from "vitest";
import { QueryTypes, Sequelize } from "sequelize";
import type { Model, ModelStatic } from "sequelize";
import db from "../../../../src/models/index.js";
import sequelize from "../../../../src/db.js";
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
import { updateItemEditingConfirmUseCase } from "../../../../src/usecases/itemEditing/updateConfirm.js";
import { updateItemEditingConfirmBodySchema } from "../../../../src/validators/body/itemEditing.js";
import type { ItemEditingConfirmBody } from "../../../../src/validators/body/itemEditing.js";
import { makeBody } from "./fixtures.js";

export { sequelize, ItemEditing, Item, User, Categories, Brands, BrandAliases };
export { ItemConditionOption, ShippingDayOption, ShippingServiceOption, TodouhukenOption };
export const observer = new Sequelize(process.env.DATABASE_URL!, {
    dialect: "postgres",
    logging: false,
    dialectOptions: process.env.DB_SSL === "true" ? { ssl: { require: true, rejectUnauthorized: false } } : {},
});

const cleanupModels: ModelStatic<Model>[] = [
    ItemEditing, Item, BrandAliases, Brands, Categories,
    ItemConditionOption, ShippingDayOption, ShippingServiceOption, TodouhukenOption, User,
];
const created = new Map<ModelStatic<Model>, number[]>();
let safe = false;

beforeAll(async () => {
    const connections: Sequelize[] = [sequelize, db.sequelize, observer];
    for (const connection of connections) {
        if (connection.getDatabaseName() !== "test_db") {
            throw new Error("DB_TEST_STOP: Sequelize database is not test_db; user decision required");
        }
        const [row] = await connection.query<{ name: string }>("SELECT current_database() AS name", {
            type: QueryTypes.SELECT, logging: false,
        });
        if (row.name !== "test_db") {
            throw new Error("DB_TEST_STOP: actual database is not test_db; user decision required");
        }
    }
    safe = true;
    for (const model of cleanupModels) {
        model.addHook("afterCreate", "updateConfirmTrack", (row: Model) => {
            created.get(model)!.push(row.get("id") as number);
        });
    }
});

beforeEach(() => {
    for (const model of cleanupModels) created.set(model, []);
});

afterEach(async () => {
    vi.restoreAllMocks();
    if (!safe) return;
    // 全件削除せず、失敗したtransactionのIDも含め、このテストが作った行だけを消す。
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
    for (const model of cleanupModels) model.removeHook("afterCreate", "updateConfirmTrack");
    await Promise.all([sequelize.close(), (db.sequelize as Sequelize).close(), observer.close()]);
    vi.unstubAllEnvs();
});

export const seed = async () => {
    if (!safe) throw new Error("DB_TEST_STOP: database has not been verified");
    const prefix = `uc${randomUUID().replaceAll("-", "")}`;
    const owner = await User.create({ email: `${prefix}@example.test`, password: "unused-test-value" });
    const other = await User.create({ email: `${prefix}other@example.test`, password: "unused-test-value" });
    const category = await Categories.create({
        name: prefix, level: 1, path: prefix, body_category: "top", lifestyle_category: "casual", layer: "middle",
    });
    const condition = await ItemConditionOption.create({ name: "新品" });
    const day = await ShippingDayOption.create({ name: "翌日" });
    const service = await ShippingServiceOption.create({ name: "テスト配送" });
    const place = await TodouhukenOption.create({ name: "東京都" });
    const brand = await Brands.create({ name: prefix, name_normalized: prefix });
    const item = await Item.create({ seller_id: owner.id, name: "公開商品", price: 900, uploaded_at: new Date("2026-01-01T00:00:00Z") });
    const editing = await ItemEditing.create({
        seller_id: owner.id, item_id: item.id, name: "更新前", detail: "以前の説明", price: 900, before_price: 1200,
        original_url: "https://media.test/old-video", thumbnail_url: "https://media.test/old-thumbnail",
        image_url: ["https://media.test/old-image0", "https://media.test/old-image1"],
        first_image_url: "https://media.test/old-image0", title: "旧題名", summary: "旧説明", duration: 20,
        attributes: {
            inventory: { initial: 10, current: 4, low_stock_ratio: 0.5 },
            colorVariants: [
                { uiId: "red", image_url: "https://media.test/red" },
                { uiId: "blue", image_url: "https://media.test/blue" },
            ],
            materials: [{ name: "旧素材", ratio: 100 }],
        },
    });
    const otherEditing = await ItemEditing.create({ seller_id: other.id, name: "他の商品", price: 800 });
    const body = makeBody();
    body.category.id = String(category.id);
    body.condition.id = String(condition.id);
    body.shipping = { day: String(day.id), service: String(service.id), place: String(place.id), freeText: "配送備考" };
    body.brand = { id: String(brand.id), name: brand.name };
    return { prefix, owner, other, category, condition, day, service, place, brand, item, editing, otherEditing, body };
};

export type DbFixture = Awaited<ReturnType<typeof seed>>;
export const run = (fixture: DbFixture, body: ItemEditingConfirmBody = fixture.body, id = fixture.editing.id, userId = fixture.owner.id) =>
    updateItemEditingConfirmUseCase({ itemEditingId: id, userId, body: updateItemEditingConfirmBodySchema.parse(body) });

export const snapshot = async (id: number) => {
    const rows = await observer.query<Record<string, unknown>>('SELECT * FROM item_editing WHERE id = :id', {
        replacements: { id }, type: QueryTypes.SELECT,
    });
    return rows[0] ?? null;
};

export const newImages = (count: number) => Array.from({ length: count }, (_, index) => ({
    name: `商品画像${index}`, type: "image/png", uploaded: false,
}));

export const newMedia = (body: ItemEditingConfirmBody) => {
    body.video = { name: "動画", type: "video/mp4", uploaded: false };
    body.thumbnail = { name: "サムネイル", type: "image/png", uploaded: false };
    body.itemImages = newImages(2);
};
