import "./databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError, ForeignKeyConstraintError, ValidationError } from "sequelize";
import {
    seed, run, snapshot, newImages, newMedia, sequelize, observer, ItemEditing, Item, Categories, BrandAliases,
    ItemConditionOption, ShippingDayOption, ShippingServiceOption, TodouhukenOption, Brands,
} from "./databaseFixtures.js";
import type { DbFixture } from "./databaseFixtures.js";
import { expectAppError } from "./fixtures.js";
import { getMyItemEditing } from "../../../../src/services/itemEditing/query.js";
import * as command from "../../../../src/services/itemEditing/command.js";

let f: DbFixture;
beforeEach(async () => { f = await seed(); });

describe("P0 DB保存・状態遷移", () => {
    it("N02 N05 ST02 D03 D05 D06 D08 D10: 全保存項目と非対象行・公開商品・所有者を確認", async () => {
        const before = await snapshot(f.editing.id);
        const other = await snapshot(f.otherEditing.id);
        const published = (await Item.findByPk(f.item.id))!.toJSON();
        f.body.attributes.colorVariants = [
            { uiId: "blue", color: "青", inventory: 0, sizes: [] },
            { uiId: "red", color: "赤", inventory: 8, sizes: [{ size: "M", inventory: 1 }, { size: "L", inventory: 8 }] },
        ];
        f.body.attributes.materials = [{ name: "綿", ratio: 80.5 }, { name: "麻", ratio: 19.5 }];
        f.body.itemImages.push({ name: "2枚目", type: "image/png", uploaded: true });
        expect(await run(f)).toEqual({ videoSignedUrl: null, thumbnailSignedUrl: null, itemImageSignedUrls: [], attributesImageSignedUrls: {} });
        const after = await snapshot(f.editing.id);
        expect(after).toEqual({
            ...before, updatedAt: expect.any(Date), name: "商品名", detail: "商品説明", price: 300, before_price: 300,
            title: "動画タイトル", summary: "動画説明", category_id: f.category.id, item_condition_id: f.condition.id,
            gender_type: "unisex", age_type: "both", brand_id: f.brand.id, brand_aliases_id: null,
            shipping_day_id: f.day.id, shipping_service_id: f.service.id, shipping_place_id: f.place.id,
            shipping_service_free_text: "配送備考",
            attributes: {
                inventory: { initial: 1, current: 1, low_stock_ratio: 0.2 },
                colorVariants: [
                    { uiId: "blue", color: "青", inventory: { initial: 0, current: 0, low_stock_ratio: 0.2 }, image_url: "https://media.test/blue", sizes: [] },
                    { uiId: "red", color: "赤", inventory: { initial: 8, current: 8, low_stock_ratio: 0.2 }, image_url: "https://media.test/red", sizes: [
                        { size: "M", inventory: { initial: 1, current: 1, low_stock_ratio: 0.2 } },
                        { size: "L", inventory: { initial: 8, current: 8, low_stock_ratio: 0.2 } },
                    ] },
                ],
                materials: [{ name: "綿", ratio: 80.5 }, { name: "麻", ratio: 19.5 }],
                body_category: "top", lifestyle_category: "casual", layer: "middle",
            },
        });
        expect(await snapshot(f.otherEditing.id)).toEqual(other);
        expect((await Item.findByPk(f.item.id))!.toJSON()).toEqual(published);
    });

    it("ST01 D10: メディア未入力・item_id=nullの行を更新し行を増やさない", async () => {
        await f.editing.update({ item_id: null, name: null, original_url: null, thumbnail_url: null, image_url: null, first_image_url: null });
        const count = await ItemEditing.count({ where: { seller_id: f.owner.id } });
        const itemCount = await Item.count({ where: { seller_id: f.owner.id } });
        newMedia(f.body);
        const result = await run(f);
        const saved = (await ItemEditing.findByPk(f.editing.id))!;
        expect(saved.item_id).toBeNull();
        expect(saved.name).toBe(f.body.itemMeta.name);
        expect(saved.original_url).toMatch(/^https:\/\/media.test\/video\/original\//);
        expect(saved.thumbnail_url).toMatch(/^https:\/\/media.test\/thumbnail\//);
        expect(saved.image_url).toHaveLength(2);
        expect(saved.first_image_url).toBe(saved.image_url![0]);
        expect(result.itemImageSignedUrls.map((image) => image.index)).toEqual([0, 1]);
        expect(await ItemEditing.count({ where: { seller_id: f.owner.id } })).toBe(count);
        expect(await Item.count({ where: { seller_id: f.owner.id } })).toBe(itemCount);
    });

    it.each([null, "", "日本語の説明"])("N03: detail/summary=%sの保存表現", async (value) => {
        f.body.itemMeta.detail = value;
        f.body.videoMeta.summary = value;
        await run(f);
        expect(await snapshot(f.editing.id)).toMatchObject({ detail: value ?? "", summary: value ?? "" });
    });

    it.each([0, 1, 8])("N04 ST03: 各階層在庫%sをinitial/currentへ再設定", async (value) => {
        f.body.attributes.allInventory = value;
        f.body.attributes.colorVariants[0].inventory = value;
        f.body.attributes.colorVariants[0].sizes[0].inventory = value;
        await run(f);
        const saved = (await ItemEditing.findByPk(f.editing.id))!;
        const inventory = { initial: value, current: value, low_stock_ratio: 0.2 };
        expect(saved.attributes.inventory).toEqual(inventory);
        expect(saved.attributes.colorVariants![0].inventory).toEqual(inventory);
        expect(saved.attributes.colorVariants![0].sizes![0].inventory).toEqual(inventory);
    });

    it("N06 ST04 D05: 空配列で旧JSONを置換しundefinedキーを保存しない", async () => {
        f.body.attributes.colorVariants = [];
        f.body.attributes.materials = [];
        await run(f);
        expect((await ItemEditing.findByPk(f.editing.id))!.attributes).toEqual({
            inventory: { initial: 1, current: 1, low_stock_ratio: 0.2 },
            body_category: "top", lifestyle_category: "casual", layer: "middle",
        });
    });

    it.each(["分類null", "カテゴリなし"])("N07 D06: %sのJSON保存表現", async (mode) => {
        if (mode === "分類null") await f.category.update({ body_category: null, lifestyle_category: null });
        else f.body.category.id = null;
        await run(f);
        const saved = (await ItemEditing.findByPk(f.editing.id))!;
        expect(saved.attributes).not.toHaveProperty("body_category");
        expect(saved.attributes).not.toHaveProperty("lifestyle_category");
        if (mode === "分類null") expect(saved.attributes.layer).toBe("middle");
        else expect(saved.attributes).not.toHaveProperty("layer");
        expect(saved.category_id).toBe(mode === "分類null" ? f.category.id : null);
    });

    it("D06: nullableな全マスター・ブランドIDをnullで保存", async () => {
        f.body.category.id = null;
        f.body.condition.id = "";
        f.body.shipping = { day: null, service: null, place: null, freeText: null };
        f.body.brand = { id: null, name: null };
        await run(f);
        expect(await snapshot(f.editing.id)).toMatchObject({ category_id: null, item_condition_id: null, shipping_day_id: null,
            shipping_service_id: null, shipping_place_id: null, shipping_service_free_text: null, brand_id: null, brand_aliases_id: null });
    });

    it("ST05: サムネイルだけ変更しconverted動画と既存商品画像を引き継ぐ", async () => {
        await f.editing.update({ converted_url: "https://media.test/converted" });
        f.body.thumbnail = { name: "差替え", type: "image/png", uploaded: false };
        const result = await run(f);
        expect(await snapshot(f.editing.id)).toMatchObject({ original_url: "https://media.test/converted", converted_url: "https://media.test/converted",
            image_url: ["https://media.test/old-image0"], thumbnail_url: result.thumbnailSignedUrl!.replace("signed.test", "media.test") });
    });

    it.each([null, "pending", "completed"])("ST06: video_status=%sでも更新し変換関連値を維持", async (status) => {
        await f.editing.update({ video_status: status, converted_url: "https://media.test/converted" });
        await run(f);
        expect(await snapshot(f.editing.id)).toMatchObject({ name: "商品名", video_status: status, converted_url: "https://media.test/converted", duration: 20 });
    });

    it("ST08: 価格変更でもsale_flag・割引値を再計算しない", async () => {
        await f.editing.update({ sale_flag: true, discount_rate: 20, discount_amount: 180 });
        f.body.price = 2000;
        await run(f);
        expect(await snapshot(f.editing.id)).toMatchObject({ price: 2000, before_price: 2000, sale_flag: true, discount_rate: 20, discount_amount: 180 });
    });

    it.each(Array.from({ length: 10 }, (_, i) => i + 1))("V10 D03 D04: 画像%s件を順番どおり保存", async (count) => {
        f.body.itemImages = newImages(count);
        const result = await run(f);
        const saved = (await ItemEditing.findByPk(f.editing.id))!;
        const expected = result.itemImageSignedUrls.map((image) => image.url.replace("signed.test", "media.test"));
        expect(result.itemImageSignedUrls.map((image) => image.index)).toEqual(Array.from({ length: count }, (_, i) => i));
        expect(saved.image_url).toEqual(expected);
        expect(saved.first_image_url).toBe(expected[0]);
    });

    it("E01 D01: 他人所有行を返さず404、後続更新なし", async () => {
        const before = await snapshot(f.otherEditing.id);
        const transaction = vi.spyOn(sequelize, "transaction");
        expect(await getMyItemEditing({ itemEditingId: f.otherEditing.id, userId: f.owner.id })).toBeNull();
        await expectAppError(run(f, f.body, f.otherEditing.id), "ITEM_EDITING_NOT_FOUND", 404);
        expect(transaction).not.toHaveBeenCalled();
        expect(await snapshot(f.otherEditing.id)).toEqual(before);
    });
});

describe("P1 DB・モデル制約とrollback", () => {
    it.each([true, false])("V10 O01: 旧先頭画像あり=%sでも空画像は保存前に拒否", async (hasImage) => {
        if (!hasImage) await f.editing.update({ first_image_url: null, image_url: null });
        f.body.itemImages = [];
        const before = await snapshot(f.editing.id);
        const transaction = vi.spyOn(sequelize, "transaction");
        await expectAppError(run(f), "ITEM_IMAGE_NULL");
        expect(transaction).not.toHaveBeenCalled();
        expect(await snapshot(f.editing.id)).toEqual(before);
    });

    it("V10 D09 E13: 画像11件はモデル検証で拒否し本体もrollback", async () => {
        f.body.itemImages = newImages(11);
        const before = await snapshot(f.editing.id);
        const update = vi.spyOn(command, "updateConfirm");
        await expect(run(f)).rejects.toThrow("画像は最大10枚までです。");
        expect(update).toHaveBeenCalledOnce();
        await expect(update.mock.results[0].value).resolves.toBeUndefined();
        expect(await snapshot(f.editing.id)).toEqual(before);
    });

    describe.each(["gender", "age"] as const)("V09 D09: %s", (field) => {
        it("NOT NULLが実DBにも存在する（モデル検証を通さない直接SQL）", async () => {
            const before = await snapshot(f.editing.id);
            const column = field === "gender" ? "gender_type" : "age_type";
            await expect(observer.query(`UPDATE item_editing SET ${column} = NULL WHERE id = :id`, {
                replacements: { id: f.editing.id },
            })).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "23502" } });
            expect(await snapshot(f.editing.id)).toEqual(before);
        });

        it.each([null, "invalid-enum"])("%sは拒否し全列rollback", async (value) => {
            f.body.genderAge[field] = value;
            const before = await snapshot(f.editing.id);
            const images = vi.spyOn(command, "updateItemEditingImage");
            const promise = run(f);
            if (value === null) await expect(promise).rejects.toBeInstanceOf(ValidationError);
            else await expect(promise).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22P02" } });
            expect(images).not.toHaveBeenCalled();
            expect(await snapshot(f.editing.id)).toEqual(before);
        });
        it.each(field === "gender" ? ["men", "women", "unisex"] : ["adult", "kids", "both"])("定義済み値%sは保存", async (value) => {
            f.body.genderAge[field] = value;
            await run(f);
            expect(await snapshot(f.editing.id)).toHaveProperty(field === "gender" ? "gender_type" : "age_type", value);
        });
    });

    describe.each(["name", "title", "freeText"] as const)("V11 D09: %sのVARCHAR", (field) => {
        it.each([0, 255, 256])("日本語%s文字の保存またはrollback", async (length) => {
            const value = "あ".repeat(length);
            if (field === "name") f.body.itemMeta.name = value;
            if (field === "title") f.body.videoMeta.title = value;
            if (field === "freeText") f.body.shipping.freeText = value;
            const column = field === "freeText" ? "shipping_service_free_text" : field;
            const before = await snapshot(f.editing.id);
            if (length <= 255) {
                await run(f);
                expect(await snapshot(f.editing.id)).toHaveProperty(column, value);
            } else {
                const images = vi.spyOn(command, "updateItemEditingImage");
                await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22001" } });
                expect(images).not.toHaveBeenCalled();
                expect(await snapshot(f.editing.id)).toEqual(before);
            }
        });
    });

    describe.each(["category", "condition", "day", "service", "place", "brand"] as const)("I03 I04: %s ID", (field) => {
        it.each(["0", " ", "-1", "1.5", "Infinity"])("入力%sの実DB結果と未更新を確認", async (value) => {
            if (field === "category") f.body.category.id = value;
            else if (field === "condition") f.body.condition.id = value;
            else if (field === "brand") f.body.brand = { id: value, name: null };
            else f.body.shipping[field] = value;
            const before = await snapshot(f.editing.id);
            const models = { category: Categories, condition: ItemConditionOption, day: ShippingDayOption,
                service: ShippingServiceOption, place: TodouhukenOption, brand: Brands };
            if (["0", " ", "-1"].includes(value)) {
                expect(await models[field].findByPk(Number(value))).toBeNull();
            }
            const promise = run(f);
            if (field === "brand" && ["0", " ", "-1", "1.5"].includes(value)) {
                await promise;
                expect(await snapshot(f.editing.id)).toMatchObject({ brand_id: null, brand_aliases_id: null });
            } else if (["0", " "].includes(value)) {
                await expect(promise).rejects.toBeInstanceOf(ForeignKeyConstraintError);
                expect(await snapshot(f.editing.id)).toEqual(before);
            } else if (value === "-1" || value === "1.5") {
                const codes = { category: "CATEGORY_NOT_FOUND", condition: "ITEM_CONDITION_NOT_FOUND", day: "SHIPPING_DAY_NOT_FOUND",
                    service: "SHIPPING_SERVICE_NOT_FOUND", place: "PLACE_NOT_FOUND", brand: "" };
                await expectAppError(promise, codes[field], 404);
                expect(await snapshot(f.editing.id)).toEqual(before);
            } else {
                await expect(promise).rejects.toBeInstanceOf(DatabaseError);
                expect(await snapshot(f.editing.id)).toEqual(before);
            }
        });
    });
});

describe("P2 ブランド・逐次再実行", () => {
    it.each(["ID", "名前", "紐付alias", "未紐付alias", "新規alias", "なし"])("N08 O02: %sの関連IDを実DBへ保存", async (mode) => {
        let brandId: number | null = f.brand.id;
        let aliasId: number | null = null;
        if (mode !== "ID") f.body.brand.id = null;
        if (mode === "紐付alias" || mode === "未紐付alias") {
            const name = `${f.prefix}alias`;
            const alias = await BrandAliases.create({ name, name_normalized: name, brand_id: mode === "紐付alias" ? f.brand.id : null });
            f.body.brand.name = name;
            aliasId = alias.id;
            if (mode === "未紐付alias") brandId = null;
        }
        if (mode === "新規alias") { f.body.brand.name = `${f.prefix}new`; brandId = null; }
        if (mode === "なし") { f.body.brand.name = null; brandId = null; }
        await run(f);
        if (mode === "新規alias") {
            const aliases = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } });
            expect(aliases).toHaveLength(1);
            aliasId = aliases[0].id;
        }
        expect(await snapshot(f.editing.id)).toMatchObject({ brand_id: brandId, brand_aliases_id: aliasId });
    });

    it("Q01: 同一bodyの2回保存で業務値一致・商品行数不変", async () => {
        const count = await ItemEditing.count({ where: { seller_id: f.owner.id } });
        await run(f);
        const first = await snapshot(f.editing.id);
        await run(f);
        const second = await snapshot(f.editing.id);
        expect(second).toEqual({ ...first, updatedAt: expect.any(Date) });
        expect(await ItemEditing.count({ where: { seller_id: f.owner.id } })).toBe(count);
    });

    it("Q02: 異なる時刻で全新規メディアを再発行し2回目URLで上書き", async () => {
        newMedia(f.body);
        f.body.attributes.colorVariants[0].image = { name: "赤", type: "image/png", uploaded: false };
        const now = vi.spyOn(Date, "now").mockReturnValue(1800000000000);
        const first = await run(f);
        const before = await snapshot(f.editing.id);
        now.mockReturnValue(1800000000100);
        const second = await run(f);
        const saved = (await ItemEditing.findByPk(f.editing.id))!;
        expect(second).not.toEqual(first);
        expect(saved.original_url).not.toBe(before!.original_url);
        expect(saved.original_url).toBe(`https://media.test/${second.videoSignedUrl!.fields.key}`);
        expect(saved.thumbnail_url).toBe(second.thumbnailSignedUrl!.replace("signed.test", "media.test"));
        expect(saved.image_url).toEqual(second.itemImageSignedUrls.map((image) => image.url.replace("signed.test", "media.test")));
        expect(saved.attributes.colorVariants![0].image_url).toBe(second.attributesImageSignedUrls.red.replace("signed.test", "media.test"));
    });

    it("Q03 O02: 未登録名の逐次2回実行でaliasを1行だけ作り再利用", async () => {
        f.body.brand = { id: null, name: `${f.prefix}new` };
        await run(f);
        const first = (await ItemEditing.findByPk(f.editing.id))!.brand_aliases_id;
        expect(first).not.toBeNull();
        await run(f);
        expect(await BrandAliases.count({ where: { name_normalized: f.body.brand.name } })).toBe(1);
        expect((await ItemEditing.findByPk(f.editing.id))!.brand_aliases_id).toBe(first);
    });
});
