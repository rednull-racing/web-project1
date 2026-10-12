import "./databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError, ForeignKeyConstraintError, ValidationError } from "sequelize";
import { seed, run, editingSnapshot, draftRows, onlyDraft, newImages, newMedia, unchanged, sequelize, observer,
    ItemDraft, Item, Categories, BrandAliases, Brands, ItemConditionOption, ShippingDayOption, ShippingServiceOption, TodouhukenOption } from "./databaseFixtures.js";
import type { DbFixture } from "./databaseFixtures.js";
import { expectAppError } from "./fixtures.js";
import * as command from "../../../../src/services/itemDraft/command.js";
let f: DbFixture;
beforeEach(async () => { f = await seed(); });
const inv = (n: number) => ({ initial: n, current: n, low_stock_ratio: 0.2 });

describe("P0: 実DBへの下書き作成", () => {
    it("N02 N05 D01 D03 D10 ST01 O02: 全保存列・所有者未設定・非対象行不変", async () => {
        const before = await editingSnapshot(f.editing.id), other = await editingSnapshot(f.otherEditing.id), published = f.item.toJSON();
        f.body.attributes.colorVariants = [
            { uiId: "blue", color: "青", inventory: 0, sizes: [] },
            { uiId: "red", color: "赤", inventory: 8, sizes: [{ size: "M", inventory: 1 }, { size: "L", inventory: 8 }] },
        ];
        f.body.attributes.materials = [{ name: "綿", ratio: 80.5 }, { name: "麻", ratio: 19.5 }];
        f.body.itemImages.push({ name: "2枚目", type: "image/png", uploaded: true });
        const count = await Item.count({ where: { seller_id: f.owner.id } });
        expect(await run(f)).toEqual({ videoSignedUrl: null, thumbnailSignedUrl: null, itemImageSignedUrls: [], attributesImageSignedUrls: {} });
        expect(await onlyDraft()).toEqual({
            id: expect.any(Number), item_id: null, seller_id: null, name: "商品名", detail: "商品説明", price: 300, before_price: 300,
            image_url: ["https://media.test/old-image0", "https://media.test/old-image1"], first_image_url: "https://media.test/old-image0",
            category_id: f.category.id, item_condition_id: f.condition.id, gender_type: "unisex", age_type: "both",
            brand_id: f.brand.id, brand_aliases_id: null, recommend: false,
            title: "動画タイトル", summary: "動画説明", original_url: "https://media.test/old-video", thumbnail_url: "https://media.test/old-thumbnail",
            converted_url: null, duration: null, video_status: null, sale_flag: false, discount_rate: null, discount_amount: null,
            shipping_day_id: f.day.id, shipping_service_id: f.service.id, shipping_place_id: f.place.id, shipping_service_free_text: "配送備考",
            attributes: { inventory: inv(1), colorVariants: [
                { uiId: "blue", color: "青", inventory: inv(0), image_url: "https://media.test/blue", sizes: [] },
                { uiId: "red", color: "赤", inventory: inv(8), image_url: "https://media.test/red", sizes: [{ size: "M", inventory: inv(1) }, { size: "L", inventory: inv(8) }] },
            ], materials: [{ name: "綿", ratio: 80.5 }, { name: "麻", ratio: 19.5 }], body_category: "top", lifestyle_category: "casual", layer: "middle" },
            createdAt: expect.any(Date), updatedAt: expect.any(Date),
        });
        await unchanged(f, before, other, published);
        expect(await Item.count({ where: { seller_id: f.owner.id } })).toBe(count);
    });
    it("D02 O02: 参照元のsale・割引・動画変換値は作成先にコピーしない", async () => {
        await f.editing.update({ sale_flag: true, recommend: true, discount_rate: 20, discount_amount: 100, converted_url: "converted", video_status: "completed" });
        const before = await editingSnapshot(f.editing.id);
        await run(f);
        expect(await onlyDraft()).toMatchObject({ seller_id: null, item_id: null, sale_flag: false, recommend: false, discount_rate: null,
            discount_amount: null, duration: null, converted_url: null, video_status: null, original_url: "converted" });
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each([null, "", "日本語"])("N03 N11 D03: nullable文章%sの保存", async (value) => {
        f.body.itemMeta.detail = value; f.body.videoMeta.summary = value; f.body.shipping.freeText = value;
        await run(f); expect(await onlyDraft()).toMatchObject({ detail: value ?? "", summary: value ?? "", shipping_service_free_text: value });
    });
    it.each([0, 1, 8])("N04 ST03 D03: 在庫%sを全階層に保存、元在庫は維持", async (value) => {
        f.body.attributes.allInventory = value; f.body.attributes.colorVariants[0].inventory = value; f.body.attributes.colorVariants[0].sizes[0].inventory = value;
        const before = await editingSnapshot(f.editing.id); await run(f);
        expect((await onlyDraft()).attributes).toMatchObject({ inventory: inv(value), colorVariants: [{ inventory: inv(value), sizes: [{ inventory: inv(value) }] }] });
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it("N06 D03 ST05: 空の色・素材はJSONBでキー省略、元属性不変", async () => {
        f.body.attributes.colorVariants = []; f.body.attributes.materials = [];
        const before = await editingSnapshot(f.editing.id); await run(f);
        expect((await onlyDraft()).attributes).toEqual({ inventory: inv(1), body_category: "top", lifestyle_category: "casual", layer: "middle" });
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each(["分類null", "カテゴリなし"])("N07 D03: %sは該当JSONキー省略", async (mode) => {
        if (mode === "分類null") await f.category.update({ body_category: null, lifestyle_category: null }); else f.body.category.id = null;
        await run(f); const saved = await onlyDraft();
        expect(saved.attributes).not.toHaveProperty("body_category"); expect(saved.attributes).not.toHaveProperty("lifestyle_category");
        if (mode === "分類null") expect(saved.attributes).toHaveProperty("layer", "middle"); else expect(saved.attributes).not.toHaveProperty("layer");
    });
    it.each([undefined, ""])("N09 D03: color=%s、空サイズ、色画像欠落を保存", async (color) => {
        f.body.attributes.colorVariants[0].color = color; f.body.attributes.colorVariants[0].uiId = "missing"; f.body.attributes.colorVariants[0].sizes[0].size = "";
        await run(f); const saved = (await ItemDraft.findByPk((await onlyDraft()).id as number))!;
        const variant = saved.attributes.colorVariants![0];
        expect(variant).not.toHaveProperty("image_url");
        if (color === undefined) expect(variant).not.toHaveProperty("color"); else expect(variant.color).toBe("");
        expect(variant.sizes![0].size).toBe("");
    });
    it("I01 D03 D07: nullable IDはnullのまま保存", async () => {
        f.body.category.id = null; f.body.condition.id = ""; f.body.shipping = { day: null, service: null, place: null, freeText: null }; f.body.brand = { id: null, name: null };
        await run(f); expect(await onlyDraft()).toMatchObject({ category_id: null, item_condition_id: null, shipping_day_id: null,
            shipping_service_id: null, shipping_place_id: null, brand_id: null, brand_aliases_id: null });
    });
    it.each([null, "pending", "completed"])("ST06: 元video_status=%sでも作成、元行は不変", async (status) => {
        await f.editing.update({ video_status: status }); const before = await editingSnapshot(f.editing.id);
        await run(f); expect((await onlyDraft()).video_status).toBeNull(); expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each([false, true])("ST04 D10: item_id=null、新規動画=%sでも元行を残して作成", async (fresh) => {
        await f.editing.update({ item_id: null, converted_url: "https://media.test/converted" });
        if (fresh) newMedia(f.body); const before = await editingSnapshot(f.editing.id); const result = await run(f);
        expect((await onlyDraft()).original_url).toBe(fresh ? `https://media.test/${result.videoSignedUrl!.fields.key}` : "https://media.test/converted");
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each(["他人", "不存在", "所有者null"])("E01: %sの取得は404、作成なし", async (mode) => {
        let id = f.otherEditing.id;
        if (mode === "不存在") { id = f.editing.id; await f.editing.destroy(); }
        if (mode === "所有者null") { id = f.editing.id; await f.editing.update({ seller_id: null }); }
        const other = await editingSnapshot(f.otherEditing.id), transaction = vi.spyOn(sequelize, "transaction");
        await expectAppError(run(f, f.body, id), "ITEM_EDITING_NOT_FOUND", 404);
        expect(transaction).not.toHaveBeenCalled(); expect(await draftRows()).toEqual([]); expect(await editingSnapshot(f.otherEditing.id)).toEqual(other);
    });
});

describe("P1: DB・モデル制約", () => {
    it.each([1, 9, 10])("D05: 確定画像%s枚を順序通り保存", async (count) => {
        f.body.itemImages = newImages(count); const result = await run(f), saved = await onlyDraft();
        const urls = result.itemImageSignedUrls.map(v => v.url.replace("signed.test", "media.test"));
        expect(saved.image_url).toEqual(urls); expect(saved.first_image_url).toBe(urls[0]);
    });
    it("D05: 入力11枚でも確定10枚なら保存", async () => {
        f.body.itemImages = [...newImages(10), { name: "欠落", type: null, uploaded: false }]; await run(f);
        expect((await onlyDraft()).image_url).toHaveLength(10);
    });
    it("D05 E11: 確定11枚はモデルで拒否、本体INSERTもrollback", async () => {
        f.body.itemImages = newImages(11); const create = vi.spyOn(command, "CreateItemDraft");
        await expect(run(f)).rejects.toThrow("画像は最大10枚までです。");
        expect(create).toHaveBeenCalledOnce(); await expect(create.mock.results[0].value).resolves.toBeInstanceOf(ItemDraft);
        expect(await draftRows()).toEqual([]);
    });
    it("E04: 画像0件はtransaction前に400", async () => {
        f.body.itemImages = []; const transaction = vi.spyOn(sequelize, "transaction");
        await expectAppError(run(f), "ITEM_IMAGE_NULL"); expect(transaction).not.toHaveBeenCalled(); expect(await draftRows()).toEqual([]);
    });
    describe.each(["gender", "age"] as const)("D04 V15: %s", (field) => {
        it.each([null, "", "invalid"])("値%sは拒否し後続画像保存なし", async (value) => {
            f.body.genderAge[field] = value; const images = vi.spyOn(command, "updateItemDraftImage"), pending = run(f);
            if (value === null) await expect(pending).rejects.toBeInstanceOf(ValidationError);
            else await expect(pending).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22P02" } });
            expect(images).not.toHaveBeenCalled(); expect(await draftRows()).toEqual([]);
        });
        it.each(field === "gender" ? ["men", "women", "unisex"] : ["adult", "kids", "both"])("値%sを保存", async (value) => {
            f.body.genderAge[field] = value; await run(f); expect(await onlyDraft()).toHaveProperty(`${field}_type`, value);
        });
    });
    describe.each(["name", "title", "freeText", "brand"] as const)("D06 V16: %sの文字数", (field) => {
        it.each([0, 254, 255, 256])("日本語%s文字の保存・拒否", async (length) => {
            const value = "あ".repeat(length);
            if (field === "name") f.body.itemMeta.name = value;
            if (field === "title") f.body.videoMeta.title = value;
            if (field === "freeText") f.body.shipping.freeText = value;
            if (field === "brand") f.body.brand = { id: null, name: `${f.prefix}${value}`.slice(0, length) };
            if (length > 255) { await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22001" } }); expect(await draftRows()).toEqual([]); }
            else { await run(f); if (field !== "brand") expect(await onlyDraft()).toHaveProperty(field === "freeText" ? "shipping_service_free_text" : field, value); }
            if (field === "brand" && length > 255) expect(await BrandAliases.count({ where: { name: f.body.brand.name } })).toBe(0);
        });
    });
    const targets = ["category", "condition", "day", "service", "place", "brand"] as const;
    describe.each(targets)("I03 I04 D07 O06: %s ID", (field) => {
        it.each(["0", " ", "-1", "1.5", "Infinity", "2147483648"])("値%sの失敗位置またはbrand fallback", async (value) => {
            const models = { category: Categories, condition: ItemConditionOption, day: ShippingDayOption, service: ShippingServiceOption, place: TodouhukenOption, brand: Brands };
            if (["0", " ", "-1"].includes(value)) expect(await models[field].findByPk(Number(value))).toBeNull();
            if (field === "category") f.body.category.id = value; else if (field === "condition") f.body.condition.id = value;
            else if (field === "brand") f.body.brand = { id: value, name: null }; else f.body.shipping[field] = value;
            const pending = run(f);
            if (field === "brand" && value !== "Infinity") { await pending; expect(await onlyDraft()).toMatchObject({ brand_id: null, brand_aliases_id: null }); }
            else if (["0", " "].includes(value)) { await expect(pending).rejects.toBeInstanceOf(ForeignKeyConstraintError); expect(await draftRows()).toEqual([]); }
            else if (value !== "Infinity") {
                const codes = { category: "CATEGORY_NOT_FOUND", condition: "ITEM_CONDITION_NOT_FOUND", day: "SHIPPING_DAY_NOT_FOUND", service: "SHIPPING_SERVICE_NOT_FOUND", place: "PLACE_NOT_FOUND", brand: "" };
                await expectAppError(pending, codes[field], 404); expect(await draftRows()).toEqual([]);
            } else { await expect(pending).rejects.toBeInstanceOf(DatabaseError); expect(await draftRows()).toEqual([]); }
        });
    });
    it.each(["NOT NULL", "ENUM", "FK"])("D09: %sをモデル経由でなく直接SQLで確認", async (kind) => {
        await run(f); const row = await onlyDraft();
        const column = kind === "NOT NULL" || kind === "ENUM" ? "gender_type" : "category_id";
        if (kind === "FK") expect(await Categories.findByPk(-1)).toBeNull();
        await expect(observer.query(`UPDATE item_draft SET ${column} = :value WHERE id = :id`, {
            replacements: { id: row.id, value: kind === "NOT NULL" ? null : kind === "ENUM" ? "bad" : -1 },
        })).rejects.toMatchObject({ parent: { code: kind === "NOT NULL" ? "23502" : kind === "ENUM" ? "22P02" : "23503" } });
        expect(await onlyDraft()).toEqual(row);
    });
    it.each(["brand", "alias"])("D08: %s削除は参照FKだけSET NULL", async (mode) => {
        if (mode === "alias") f.body.brand = { id: null, name: `${f.prefix}alias` };
        await run(f); const before = await onlyDraft();
        if (mode === "brand") await f.brand.destroy(); else await BrandAliases.destroy({ where: { id: before.brand_aliases_id } });
        expect(await onlyDraft()).toEqual({ ...before, [mode === "brand" ? "brand_id" : "brand_aliases_id"]: null });
    });
});

describe("P2: ブランド関連・逐次再実行", () => {
    it.each(["ID", "名前", "紐付alias", "未紐付alias", "新規alias", "なし"])("N08: %sの関連を保存", async (mode) => {
        let brandId: number | null = f.brand.id, aliasId: number | null = null;
        if (mode !== "ID") f.body.brand.id = null;
        if (mode === "紐付alias" || mode === "未紐付alias") {
            const name = `${f.prefix}alias`; const alias = await BrandAliases.create({ name, name_normalized: name, brand_id: mode === "紐付alias" ? f.brand.id : null });
            f.body.brand.name = name; aliasId = alias.id; if (mode === "未紐付alias") brandId = null;
        }
        if (mode === "新規alias") { f.body.brand.name = `${f.prefix}new`; brandId = null; }
        if (mode === "なし") { f.body.brand.name = null; brandId = null; }
        await run(f);
        if (mode === "新規alias") { const aliases = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } }); expect(aliases).toHaveLength(1); aliasId = aliases[0].id; }
        expect(await onlyDraft()).toMatchObject({ brand_id: brandId, brand_aliases_id: aliasId });
    });
    it("Q01 Q05 ST02 D10: 同一body再送は別行追加、既存下書き不変", async () => {
        await run(f); const first = await onlyDraft(); await run(f); const rows = await draftRows();
        expect(rows).toHaveLength(2); expect(rows[0]).toEqual(first);
        expect(rows[1]).toEqual({ ...first, id: expect.any(Number), createdAt: expect.any(Date), updatedAt: expect.any(Date) });
        expect(rows[1].id).not.toBe(first.id);
    });
    it("Q02: 同一時刻の新規メディア再送は別UUIDの2行", async () => {
        newMedia(f.body); f.body.attributes.colorVariants[0].image = { name: "赤", type: "image/png", uploaded: false };
        vi.spyOn(Date, "now").mockReturnValue(1800000000000);
        const a = await run(f), b = await run(f); const rows = await draftRows();
        expect(rows).toHaveLength(2); expect(a).not.toEqual(b);
        for (const [index, result] of [a,b].entries()) {
            expect(rows[index].original_url).toBe(`https://media.test/${result.videoSignedUrl!.fields.key}`);
            expect(rows[index].thumbnail_url).toBe(result.thumbnailSignedUrl!.replace("signed.test", "media.test"));
            expect(rows[index].image_url).toEqual(result.itemImageSignedUrls.map(v => v.url.replace("signed.test", "media.test")));
        }
    });
    it("Q03: 未登録名を逐次再送すると別下書き2行でalias1行共有", async () => {
        f.body.brand = { id: null, name: `${f.prefix}new` }; await run(f); await run(f);
        const aliases = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } });
        expect(aliases).toHaveLength(1); const rows = await draftRows(); expect(rows).toHaveLength(2);
        for (const row of rows) expect(row.brand_aliases_id).toBe(aliases[0].id);
    });
});

describe("P1: 保存値・制約・非対象行の追加確認", () => {
    describe.each(["全体", "色", "サイズ"])("N04 D03: %s在庫を独立に変更", layer => {
        it.each([0, 1, 8])("在庫%sでも他階層は標準値を維持", async value => {
            if (layer === "全体") f.body.attributes.allInventory = value;
            if (layer === "色") f.body.attributes.colorVariants[0].inventory = value;
            if (layer === "サイズ") f.body.attributes.colorVariants[0].sizes[0].inventory = value;
            await run(f);
            const row = await onlyDraft(), saved = (await ItemDraft.findByPk(row.id as number))!;
            expect(saved.attributes.inventory).toEqual(inv(layer === "全体" ? value : 1));
            expect(saved.attributes.colorVariants![0].inventory).toEqual(inv(layer === "色" ? value : 2));
            expect(saved.attributes.colorVariants![0].sizes![0].inventory).toEqual(inv(layer === "サイズ" ? value : 3));
        });
    });
    it("N06 D03: 色は残してsizesだけ空配列に保存", async () => {
        f.body.attributes.colorVariants[0].sizes = []; await run(f);
        const saved = (await ItemDraft.findByPk((await onlyDraft()).id as number))!;
        expect(saved.attributes.colorVariants![0].sizes).toEqual([]);
        expect(saved.attributes.materials).toEqual([{ name: "綿", ratio: 80 }, { name: "麻", ratio: 20 }]);
    });
    it.each(["category", "condition", "day", "service", "place"] as const)("D07 E07: %sの実マスター不存在は404・後続保存なし", async field => {
        const target = f[field]; await target.destroy();
        const codes = { category: "CATEGORY_NOT_FOUND", condition: "ITEM_CONDITION_NOT_FOUND", day: "SHIPPING_DAY_NOT_FOUND", service: "SHIPPING_SERVICE_NOT_FOUND", place: "PLACE_NOT_FOUND" };
        const transaction = vi.spyOn(sequelize, "transaction"); await expectAppError(run(f), codes[field], 404);
        expect(transaction).not.toHaveBeenCalled(); expect(await draftRows()).toEqual([]);
    });
    it.each(["name", "title", "freeText"] as const)("D06: %sの実DB文字数違反で新規aliasもrollback", async field => {
        const name = `${f.prefix}length`; f.body.brand = { id: null, name };
        if (field === "name") f.body.itemMeta.name = "あ".repeat(256);
        if (field === "title") f.body.videoMeta.title = "あ".repeat(256);
        if (field === "freeText") f.body.shipping.freeText = "あ".repeat(256);
        const aliasCreate = vi.spyOn(BrandAliases, "create"), images = vi.spyOn(command, "updateItemDraftImage");
        await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22001" } });
        expect(aliasCreate).toHaveBeenCalledOnce(); await expect(aliasCreate.mock.results[0].value).resolves.toBeInstanceOf(BrandAliases);
        expect(images).not.toHaveBeenCalled(); expect(await draftRows()).toEqual([]);
        expect(await BrandAliases.count({ where: { name_normalized: name } })).toBe(0);
    });
    it.each([255, 256])("D06: 未登録ブランド名%s文字の関連保存または全体rollback", async length => {
        const name = `${f.prefix}${"名".repeat(length)}`.slice(0, length); f.body.brand = { id: null, name };
        if (length === 255) {
            await run(f); const aliases = await BrandAliases.findAll({ where: { name_normalized: name } });
            expect(aliases).toHaveLength(1); expect(aliases[0].name).toBe(name);
            expect(await onlyDraft()).toMatchObject({ brand_id: null, brand_aliases_id: aliases[0].id });
        } else {
            await expect(run(f)).rejects.toMatchObject({ name: "SequelizeDatabaseError", parent: { code: "22001" } });
            expect(await draftRows()).toEqual([]); expect(await BrandAliases.count({ where: { name_normalized: name } })).toBe(0);
        }
    });
    it("D10 ST02: 無関係な既存下書きの全列を維持", async () => {
        const existing = await ItemDraft.create({ seller_id: f.other.id, item_id: f.item.id, name: "既存下書き", price: 800,
            attributes: { inventory: { initial: 9, current: 6, low_stock_ratio: 0.1 } } });
        const before = existing.toJSON(), editing = await editingSnapshot(f.editing.id), other = await editingSnapshot(f.otherEditing.id), published = f.item.toJSON();
        await run(f);
        expect((await ItemDraft.findByPk(existing.id))!.toJSON()).toEqual(before);
        await unchanged(f, editing, other, published);
        expect((await draftRows()).filter(row => row.id !== existing.id)).toHaveLength(1);
    });
});
