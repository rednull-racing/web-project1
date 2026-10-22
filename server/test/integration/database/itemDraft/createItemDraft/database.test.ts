import "../../../../fixtures/itemDraft/createItemDraft/databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ValidationError } from "sequelize";
import {
    seed,
    run,
    editingSnapshot,
    draftRows,
    onlyDraft,
    newImages,
    newMedia,
    unchanged,
    sequelize,
    observer,
    ItemDraft,
    Item,
    Categories,
    BrandAliases,
} from "../../../../fixtures/itemDraft/createItemDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemDraft/createItemDraft/databaseFixtures.js";
import { createItemDraftBodySchema as schema } from "../../../../../src/validators/body/itemDraft.js";
import { expectAppError } from "../../../../fixtures/itemDraft/createItemDraft/fixtures.js";
import * as command from "../../../../../src/services/itemDraft/command.js";
let f: DbFixture;
beforeEach(async () => {
    f = await seed();
});
const inv = (n: number) => ({ initial: n, current: n, low_stock_ratio: 0.2 });

describe("P0: 実DBへの下書き作成", () => {
    it("AF-OWN01 N02 N05 D01 D03 D10 ST01 O02: 全保存列・認証所有者・非対象行不変", async () => {
        const before = await editingSnapshot(f.editing.id),
            other = await editingSnapshot(f.otherEditing.id),
            published = f.item.toJSON();
        f.body.attributes.colorVariants = [
            { uiId: "blue", color: "青", inventory: 0, sizes: [] },
            {
                uiId: "red",
                color: "赤",
                inventory: 8,
                sizes: [
                    { size: "M", inventory: 1 },
                    { size: "L", inventory: 8 },
                ],
            },
        ];
        f.body.attributes.materials = [
            { name: "綿", ratio: 80.5 },
            { name: "麻", ratio: 19.5 },
        ];
        f.body.itemImages.push({ name: "2枚目", type: "image/png", uploaded: true });
        const count = await Item.count({ where: { seller_id: f.owner.id } });
        expect(await run(f)).toEqual({
            videoSignedUrl: null,
            thumbnailSignedUrl: null,
            itemImageSignedUrls: [],
            attributesImageSignedUrls: {},
        });
        expect(await onlyDraft()).toEqual({
            id: expect.any(Number),
            seller_id: f.owner.id,
            name: "商品名",
            detail: "商品説明",
            price: 300,
            before_price: 300,
            image_url: ["https://media.test/old-image0", "https://media.test/old-image1"],
            first_image_url: "https://media.test/old-image0",
            category_id: f.category.id,
            item_condition_id: f.condition.id,
            gender_type: "unisex",
            age_type: "both",
            brand_id: f.brand.id,
            brand_aliases_id: null,
            recommend: false,
            title: "動画タイトル",
            summary: "動画説明",
            original_url: "https://media.test/old-video",
            thumbnail_url: "https://media.test/old-thumbnail",
            converted_url: null,
            duration: null,
            video_status: null,
            sale_flag: false,
            discount_rate: null,
            discount_amount: null,
            shipping_day_id: f.day.id,
            shipping_service_id: f.service.id,
            shipping_place_id: f.place.id,
            shipping_service_free_text: "配送備考",
            attributes: {
                inventory: inv(1),
                colorVariants: [
                    { uiId: "blue", color: "青", inventory: inv(0), image_url: "https://media.test/blue", sizes: [] },
                    {
                        uiId: "red",
                        color: "赤",
                        inventory: inv(8),
                        image_url: "https://media.test/red",
                        sizes: [
                            { size: "M", inventory: inv(1) },
                            { size: "L", inventory: inv(8) },
                        ],
                    },
                ],
                materials: [
                    { name: "綿", ratio: 80.5 },
                    { name: "麻", ratio: 19.5 },
                ],
                body_category: "top",
                lifestyle_category: "casual",
                layer: "middle",
            },
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        });
        await unchanged(f, before, other, published);
        expect(await Item.count({ where: { seller_id: f.owner.id } })).toBe(count);
    });
    it("D02 O02: 参照元のsale・割引・動画変換値は作成先にコピーしない", async () => {
        await f.editing.update({
            sale_flag: true,
            recommend: true,
            discount_rate: 20,
            discount_amount: 100,
            converted_url: "converted",
            video_status: "completed",
        });
        const before = await editingSnapshot(f.editing.id);
        await run(f);
        expect(await onlyDraft()).toMatchObject({
            seller_id: f.owner.id,
            sale_flag: false,
            recommend: false,
            discount_rate: null,
            discount_amount: null,
            duration: null,
            converted_url: null,
            video_status: null,
            original_url: "converted",
        });
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each([null, "", "日本語"])("N03 N11 D03: nullable文章%sの保存", async (value) => {
        f.body.itemMeta.detail = value;
        f.body.videoMeta.summary = value;
        f.body.shipping.freeText = value;
        await run(f);
        expect(await onlyDraft()).toMatchObject({
            detail: value ?? "",
            summary: value ?? "",
            shipping_service_free_text: value,
        });
    });
    it.each([0, 1, 8])("N04 ST03 D03: 在庫%sを全階層に保存、元在庫は維持", async (value) => {
        f.body.attributes.allInventory = value;
        f.body.attributes.colorVariants[0].inventory = value;
        f.body.attributes.colorVariants[0].sizes[0].inventory = value;
        const before = await editingSnapshot(f.editing.id);
        await run(f);
        expect((await onlyDraft()).attributes).toMatchObject({
            inventory: inv(value),
            colorVariants: [{ inventory: inv(value), sizes: [{ inventory: inv(value) }] }],
        });
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it("N06 D03 ST05: 空の色・素材はJSONBでキー省略、元属性不変", async () => {
        f.body.attributes.colorVariants = [];
        f.body.attributes.materials = [];
        const before = await editingSnapshot(f.editing.id);
        await run(f);
        expect((await onlyDraft()).attributes).toEqual({
            inventory: inv(1),
            body_category: "top",
            lifestyle_category: "casual",
            layer: "middle",
        });
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each(["分類null", "カテゴリなし"])("N07 D03: %sは該当JSONキー省略", async (mode) => {
        if (mode === "分類null") await f.category.update({ body_category: null, lifestyle_category: null });
        else f.body.category.id = null;
        await run(f);
        const saved = await onlyDraft();
        expect(saved.attributes).not.toHaveProperty("body_category");
        expect(saved.attributes).not.toHaveProperty("lifestyle_category");
        if (mode === "分類null") expect(saved.attributes).toHaveProperty("layer", "middle");
        else expect(saved.attributes).not.toHaveProperty("layer");
    });
    it.each([undefined, ""])("N09 D03: color=%s、空サイズ、色画像欠落を保存", async (color) => {
        f.body.attributes.colorVariants[0].color = color;
        f.body.attributes.colorVariants[0].uiId = "missing";
        f.body.attributes.colorVariants[0].sizes[0].size = "";
        await run(f);
        const saved = (await ItemDraft.findByPk((await onlyDraft()).id as number))!;
        const variant = saved.attributes.colorVariants![0];
        expect(variant).not.toHaveProperty("image_url");
        if (color === undefined) expect(variant).not.toHaveProperty("color");
        else expect(variant.color).toBe("");
        expect(variant.sizes![0].size).toBe("");
    });
    it("I01 D03 D07: nullable IDはnullのまま保存", async () => {
        f.body.category.id = null;
        f.body.condition.id = "";
        f.body.shipping = { day: null, service: null, place: null, freeText: null };
        f.body.brand = { id: null, name: null };
        await run(f);
        expect(await onlyDraft()).toMatchObject({
            category_id: null,
            item_condition_id: null,
            shipping_day_id: null,
            shipping_service_id: null,
            shipping_place_id: null,
            brand_id: null,
            brand_aliases_id: null,
        });
    });
    it.each([null, "pending", "completed"])("ST06: 元video_status=%sでも作成、元行は不変", async (status) => {
        await f.editing.update({ video_status: status });
        const before = await editingSnapshot(f.editing.id);
        await run(f);
        expect((await onlyDraft()).video_status).toBeNull();
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each([false, true])("ST04 D10: item_id=null、新規動画=%sでも元行を残して作成", async (fresh) => {
        await f.editing.update({ item_id: null, converted_url: "https://media.test/converted" });
        if (fresh) newMedia(f.body);
        const before = await editingSnapshot(f.editing.id);
        const result = await run(f);
        expect((await onlyDraft()).original_url).toBe(
            fresh ? `https://media.test/${result.videoSignedUrl!.fields.key}` : "https://media.test/converted",
        );
        expect(await editingSnapshot(f.editing.id)).toEqual(before);
    });
    it.each(["他人", "不存在", "所有者null"])("E01: %sの取得は404、作成なし", async (mode) => {
        let id = f.otherEditing.id;
        if (mode === "不存在") {
            id = f.editing.id;
            await f.editing.destroy();
        }
        if (mode === "所有者null") {
            id = f.editing.id;
            await f.editing.update({ seller_id: null });
        }
        const other = await editingSnapshot(f.otherEditing.id),
            transaction = vi.spyOn(sequelize, "transaction");
        await expectAppError(run(f, f.body, id), "ITEM_EDITING_NOT_FOUND", 404);
        expect(transaction).not.toHaveBeenCalled();
        expect(await draftRows()).toEqual([]);
        expect(await editingSnapshot(f.otherEditing.id)).toEqual(other);
    });
});

describe("P1: DB・モデル制約", () => {
    it.each([1, 9, 10])("D05: 確定画像%s枚を順序通り保存", async (count) => {
        f.body.itemImages = newImages(count);
        const result = await run(f),
            saved = await onlyDraft();
        const urls = result.itemImageSignedUrls.map((v) => v.url.replace("signed.test", "media.test"));
        expect(saved.image_url).toEqual(urls);
        expect(saved.first_image_url).toBe(urls[0]);
    });
    it("D05: 入力11枚でも確定10枚なら保存", async () => {
        f.body.itemImages = [...newImages(10), { name: "欠落", type: null, uploaded: false }];
        await run(f);
        expect((await onlyDraft()).image_url).toHaveLength(10);
    });
    it("AF-IMG01 D05: 確定11枚は400、transaction・本体INSERT前に停止", async () => {
        f.body.itemImages = newImages(11);
        const create = vi.spyOn(command, "CreateItemDraft"),
            transaction = vi.spyOn(sequelize, "transaction");
        await expectAppError(run(f), "ITEM_IMAGE_LIMIT_EXCEEDED");
        expect(create).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
        expect(await draftRows()).toEqual([]);
    });
    it("D05 E11: serviceに直接渡した画像11枚は既存モデルvalidatorで拒否し保存値不変", async () => {
        await run(f);
        const before = await onlyDraft(),
            row = (await ItemDraft.findByPk(before.id as number))!;
        await expect(
            command.updateItemDraftImage({ itemDraft: row, urls: Array.from({ length: 11 }, (_, i) => `image-${i}`) }),
        ).rejects.toBeInstanceOf(ValidationError);
        expect(await onlyDraft()).toEqual(before);
    });
    it("E04: 画像0件はtransaction前に400", async () => {
        f.body.itemImages = [];
        const transaction = vi.spyOn(sequelize, "transaction");
        await expectAppError(run(f), "ITEM_IMAGE_NULL");
        expect(transaction).not.toHaveBeenCalled();
        expect(await draftRows()).toEqual([]);
    });
    describe.each(["gender", "age"] as const)("AF-V01 D04 V15: %s", (field) => {
        it("nullは未選択の既定値で保存する", async () => {
            f.body.genderAge[field] = null;
            await run(f);
            expect(await onlyDraft()).toHaveProperty(`${field}_type`, field === "gender" ? "unisex" : "both");
        });
        it.each(["", "invalid"])("値%sはschemaで拒否しtransaction・本体・画像なし", async (value) => {
            Object.assign(f.body.genderAge, { [field]: value });
            const transaction = vi.spyOn(sequelize, "transaction"),
                create = vi.spyOn(command, "CreateItemDraft"),
                images = vi.spyOn(command, "updateItemDraftImage");
            await expect(run(f)).rejects.toMatchObject({ name: "ZodError", issues: [{ path: ["genderAge", field] }] });
            expect(transaction).not.toHaveBeenCalled();
            expect(create).not.toHaveBeenCalled();
            expect(images).not.toHaveBeenCalled();
            expect(await draftRows()).toEqual([]);
        });
        it.each(field === "gender" ? ["men", "women", "unisex"] : ["adult", "kids", "both"])(
            "定義値%sを保存",
            async (value) => {
                Object.assign(f.body.genderAge, { [field]: value });
                await run(f);
                expect(await onlyDraft()).toHaveProperty(`${field}_type`, value);
            },
        );
        it("直接モデルへnullを渡すと既存NOT NULL validatorで拒否する", async () => {
            const row = ItemDraft.build({ seller_id: f.owner.id, [`${field}_type`]: null });
            await expect(row.validate()).rejects.toBeInstanceOf(ValidationError);
            expect(await draftRows()).toEqual([]);
        });
    });
    describe.each(["name", "title", "freeText", "brand"] as const)("D06 V16: %sの文字数", (field) => {
        it.each([0, 254, 255, 256])("日本語%s文字の保存・拒否", async (length) => {
            const value = "あ".repeat(length);
            if (field === "name") f.body.itemMeta.name = value;
            if (field === "title") f.body.videoMeta.title = value;
            if (field === "freeText") f.body.shipping.freeText = value;
            if (field === "brand") f.body.brand = { id: null, name: `${f.prefix}${value}`.slice(0, length) };
            if (length > 255) {
                if (field === "brand") await expectAppError(run(f), "BRAND_NAME_TOO_LONG");
                else await expect(run(f)).rejects.toMatchObject({ name: "ZodError" });
                expect(await draftRows()).toEqual([]);
            } else {
                await run(f);
                if (field !== "brand")
                    expect(await onlyDraft()).toHaveProperty(
                        field === "freeText" ? "shipping_service_free_text" : field,
                        value,
                    );
            }
            if (field === "brand" && length > 255)
                expect(await BrandAliases.count({ where: { name: f.body.brand.name } })).toBe(0);
        });
    });
    const targets = ["category", "condition", "day", "service", "place", "brand"] as const;
    describe.each(targets)("AF-I01 AF-I02 I03 I04 D07 O06: %s ID", (field) => {
        it.each(["0", " ", "-1", "1.5", "Infinity", "2147483648"])("値%sは未選択か保存前400", async (value) => {
            if (field === "category") f.body.category.id = value;
            else if (field === "condition") f.body.condition.id = value;
            else if (field === "brand") f.body.brand = { id: value, name: null };
            else f.body.shipping[field] = value;
            const transaction = vi.spyOn(sequelize, "transaction");
            if (value.trim() === "") {
                await run(f);
                const column = {
                    category: "category_id",
                    condition: "item_condition_id",
                    day: "shipping_day_id",
                    service: "shipping_service_id",
                    place: "shipping_place_id",
                    brand: "brand_id",
                }[field];
                expect(await onlyDraft()).toHaveProperty(column, null);
            } else {
                await expectAppError(run(f), "INVALID_NUMBER");
                expect(transaction).not.toHaveBeenCalled();
                expect(await draftRows()).toEqual([]);
            }
        });
    });
    it.each(["NOT NULL", "ENUM", "FK"])("D09: %sをモデル経由でなく直接SQLで確認", async (kind) => {
        await run(f);
        const row = await onlyDraft();
        const column = kind === "NOT NULL" || kind === "ENUM" ? "gender_type" : "category_id";
        if (kind === "FK") expect(await Categories.findByPk(-1)).toBeNull();
        await expect(
            observer.query(`UPDATE item_draft SET ${column} = :value WHERE id = :id`, {
                replacements: { id: row.id, value: kind === "NOT NULL" ? null : kind === "ENUM" ? "bad" : -1 },
            }),
        ).rejects.toMatchObject({
            parent: { code: kind === "NOT NULL" ? "23502" : kind === "ENUM" ? "22P02" : "23503" },
        });
        expect(await onlyDraft()).toEqual(row);
    });
    it.each(["brand", "alias"])("D08: %s削除は参照FKだけSET NULL", async (mode) => {
        if (mode === "alias") f.body.brand = { id: null, name: `${f.prefix}alias` };
        await run(f);
        const before = await onlyDraft();
        if (mode === "brand") await f.brand.destroy();
        else await BrandAliases.destroy({ where: { id: before.brand_aliases_id } });
        expect(await onlyDraft()).toEqual({ ...before, [mode === "brand" ? "brand_id" : "brand_aliases_id"]: null });
    });
});

describe("P2: ブランド関連・逐次再実行", () => {
    it.each(["ID", "名前", "紐付alias", "未紐付alias", "新規alias", "なし"])("N08: %sの関連を保存", async (mode) => {
        let brandId: number | null = f.brand.id,
            aliasId: number | null = null;
        if (mode !== "ID") f.body.brand.id = null;
        if (mode === "紐付alias" || mode === "未紐付alias") {
            const name = `${f.prefix}alias`;
            const alias = await BrandAliases.create({
                name,
                name_normalized: name,
                brand_id: mode === "紐付alias" ? f.brand.id : null,
            });
            f.body.brand.name = name;
            aliasId = alias.id;
            if (mode === "未紐付alias") brandId = null;
        }
        if (mode === "新規alias") {
            f.body.brand.name = `${f.prefix}new`;
            brandId = null;
        }
        if (mode === "なし") {
            f.body.brand.name = null;
            brandId = null;
        }
        await run(f);
        if (mode === "新規alias") {
            const aliases = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } });
            expect(aliases).toHaveLength(1);
            aliasId = aliases[0].id;
        }
        expect(await onlyDraft()).toMatchObject({ brand_id: brandId, brand_aliases_id: aliasId });
    });
    it("Q01 Q05 ST02 D10: 同一body再送は別行追加、既存下書き不変", async () => {
        await run(f);
        const first = await onlyDraft();
        await run(f);
        const rows = await draftRows();
        expect(rows).toHaveLength(2);
        expect(rows[0]).toEqual(first);
        expect(rows[1]).toEqual({
            ...first,
            id: expect.any(Number),
            createdAt: expect.any(Date),
            updatedAt: expect.any(Date),
        });
        expect(rows[1].id).not.toBe(first.id);
    });
    it("AF-DB01 Q02: 同一時刻・別UUIDの2行で色画像まで返却署名に対応", async () => {
        newMedia(f.body);
        f.body.attributes.colorVariants[0].image = { name: "赤", type: "image/png", uploaded: false };
        vi.spyOn(Date, "now").mockReturnValue(1800000000000);
        const a = await run(f),
            b = await run(f);
        const rows = await draftRows();
        expect(rows).toHaveLength(2);
        expect(a).not.toEqual(b);
        for (const [index, result] of [a, b].entries()) {
            expect(rows[index].original_url).toBe(`https://media.test/${result.videoSignedUrl!.fields.key}`);
            expect(rows[index].thumbnail_url).toBe(result.thumbnailSignedUrl!.replace("signed.test", "media.test"));
            expect(rows[index].image_url).toEqual(
                result.itemImageSignedUrls.map((v) => v.url.replace("signed.test", "media.test")),
            );
            const saved = (await ItemDraft.findByPk(rows[index].id as number))!;
            const red = saved.attributes.colorVariants!.find((variant) => variant.uiId === "red");
            expect(red?.image_url).toBe(result.attributesImageSignedUrls.red.replace("signed.test", "media.test"));
        }
        const savedRows = await Promise.all(rows.map((row) => ItemDraft.findByPk(row.id as number)));
        expect(savedRows[0]!.attributes.colorVariants!.find((v) => v.uiId === "red")!.image_url).not.toBe(
            savedRows[1]!.attributes.colorVariants!.find((v) => v.uiId === "red")!.image_url,
        );
    });
    it("Q03: 未登録名を逐次再送すると別下書き2行でalias1行共有", async () => {
        f.body.brand = { id: null, name: `${f.prefix}new` };
        await run(f);
        await run(f);
        const aliases = await BrandAliases.findAll({ where: { name_normalized: f.body.brand.name } });
        expect(aliases).toHaveLength(1);
        const rows = await draftRows();
        expect(rows).toHaveLength(2);
        for (const row of rows) expect(row.brand_aliases_id).toBe(aliases[0].id);
    });
});

describe("P1: 保存値・制約・非対象行の追加確認", () => {
    describe.each(["全体", "色", "サイズ"])("N04 D03: %s在庫を独立に変更", (layer) => {
        it.each([0, 1, 8])("在庫%sでも他階層は標準値を維持", async (value) => {
            if (layer === "全体") f.body.attributes.allInventory = value;
            if (layer === "色") f.body.attributes.colorVariants[0].inventory = value;
            if (layer === "サイズ") f.body.attributes.colorVariants[0].sizes[0].inventory = value;
            await run(f);
            const row = await onlyDraft(),
                saved = (await ItemDraft.findByPk(row.id as number))!;
            expect(saved.attributes.inventory).toEqual(inv(layer === "全体" ? value : 1));
            expect(saved.attributes.colorVariants![0].inventory).toEqual(inv(layer === "色" ? value : 2));
            expect(saved.attributes.colorVariants![0].sizes![0].inventory).toEqual(inv(layer === "サイズ" ? value : 3));
        });
    });
    it("N06 D03: 色は残してsizesだけ空配列に保存", async () => {
        f.body.attributes.colorVariants[0].sizes = [];
        await run(f);
        const saved = (await ItemDraft.findByPk((await onlyDraft()).id as number))!;
        expect(saved.attributes.colorVariants![0].sizes).toEqual([]);
        expect(saved.attributes.materials).toEqual([
            { name: "綿", ratio: 80 },
            { name: "麻", ratio: 20 },
        ]);
    });
    it.each(["category", "condition", "day", "service", "place"] as const)(
        "D07 E07: %sの実マスター不存在は404・後続保存なし",
        async (field) => {
            const target = f[field];
            await target.destroy();
            const codes = {
                category: "CATEGORY_NOT_FOUND",
                condition: "ITEM_CONDITION_NOT_FOUND",
                day: "SHIPPING_DAY_NOT_FOUND",
                service: "SHIPPING_SERVICE_NOT_FOUND",
                place: "PLACE_NOT_FOUND",
            };
            const transaction = vi.spyOn(sequelize, "transaction");
            await expectAppError(run(f), codes[field], 404);
            expect(transaction).not.toHaveBeenCalled();
            expect(await draftRows()).toEqual([]);
        },
    );
    it.each(["name", "title", "freeText"] as const)(
        "AF-V02 D06: %sの256文字はschemaで拒否しaliasも作成しない",
        async (field) => {
            const name = `${f.prefix}length`;
            f.body.brand = { id: null, name };
            if (field === "name") f.body.itemMeta.name = "あ".repeat(256);
            if (field === "title") f.body.videoMeta.title = "あ".repeat(256);
            if (field === "freeText") f.body.shipping.freeText = "あ".repeat(256);
            const aliasCreate = vi.spyOn(BrandAliases, "create"),
                images = vi.spyOn(command, "updateItemDraftImage"),
                transaction = vi.spyOn(sequelize, "transaction");
            await expect(run(f)).rejects.toMatchObject({ name: "ZodError" });
            expect(aliasCreate).not.toHaveBeenCalled();
            expect(images).not.toHaveBeenCalled();
            expect(transaction).not.toHaveBeenCalled();
            expect(await draftRows()).toEqual([]);
            expect(await BrandAliases.count({ where: { name_normalized: name } })).toBe(0);
        },
    );
    it.each(["name", "title", "shipping_service_free_text"] as const)(
        "D06: %sの実DB VARCHAR制約は直接SQLでも256文字を拒否",
        async (column) => {
            await run(f);
            const before = await onlyDraft();
            await expect(
                observer.query(`UPDATE item_draft SET ${column} = :value WHERE id = :id`, {
                    replacements: { value: "あ".repeat(256), id: before.id },
                }),
            ).rejects.toMatchObject({ parent: { code: "22001" } });
            expect(await onlyDraft()).toEqual(before);
        },
    );
    it.each([255, 256])("AF-V02 D06: 未登録ブランド名%s文字の関連保存またはINSERT前拒否", async (length) => {
        const name = `${f.prefix}${"名".repeat(length)}`.slice(0, length);
        f.body.brand = { id: null, name };
        if (length === 255) {
            await run(f);
            const aliases = await BrandAliases.findAll({ where: { name_normalized: name } });
            expect(aliases).toHaveLength(1);
            expect(aliases[0].name).toBe(name);
            expect(await onlyDraft()).toMatchObject({ brand_id: null, brand_aliases_id: aliases[0].id });
        } else {
            await expectAppError(run(f), "BRAND_NAME_TOO_LONG");
            expect(await draftRows()).toEqual([]);
            expect(await BrandAliases.count({ where: { name_normalized: name } })).toBe(0);
        }
    });
    it("D10 ST02: 無関係な既存下書きの全列を維持", async () => {
        const existing = await ItemDraft.create({
            seller_id: f.other.id,
            name: "既存下書き",
            price: 800,
            attributes: { inventory: { initial: 9, current: 6, low_stock_ratio: 0.1 } },
        });
        const before = existing.toJSON(),
            editing = await editingSnapshot(f.editing.id),
            other = await editingSnapshot(f.otherEditing.id),
            published = f.item.toJSON();
        await run(f);
        expect((await ItemDraft.findByPk(existing.id))!.toJSON()).toEqual(before);
        await unchanged(f, editing, other, published);
        expect((await draftRows()).filter((row) => row.id !== existing.id)).toHaveLength(1);
    });
});

describe("P0/P1: F2・F4のDB保存追加境界", () => {
    it("AF-OWN02: bodyの所有者混入はschemaで除去し認証所有者で保存", async () => {
        Object.assign(f.body, { userId: f.other.id, seller_id: f.other.id, item_id: f.item.id });
        await run(f);
        expect(await onlyDraft()).toMatchObject({ seller_id: f.owner.id });
        expect(await onlyDraft()).not.toHaveProperty("item_id");
    });
    it.each([null, "men", "women", "unisex"] as const)("AF-V01: gender=%sとage=nullを保存", async (gender) => {
        f.body.genderAge = { gender, age: null };
        await run(f);
        expect(await onlyDraft()).toMatchObject({ gender_type: gender ?? "unisex", age_type: "both" });
    });
    it.each(["itemMeta", "videoMeta", "shipping"] as const)(
        "AF-V02: %sの補助平面255文字を実DBに保存",
        async (field) => {
            const value = "𠮷".repeat(255);
            if (field === "itemMeta") f.body.itemMeta.name = value;
            if (field === "videoMeta") f.body.videoMeta.title = value;
            if (field === "shipping") f.body.shipping.freeText = value;
            await run(f);
            expect(await onlyDraft()).toHaveProperty(
                field === "itemMeta" ? "name" : field === "videoMeta" ? "title" : "shipping_service_free_text",
                value,
            );
        },
    );
    it.each(["ゼロ付き", "空白付き", "指数形式"])("AF-I02: %sの有効IDを実DBで同じ関連へ保存", async (mode) => {
        const format = (id: number) => (mode === "ゼロ付き" ? `0${id}` : mode === "空白付き" ? ` ${id} ` : `${id}e0`);
        f.body.category.id = format(f.category.id);
        f.body.condition.id = format(f.condition.id);
        f.body.shipping.day = format(f.day.id);
        f.body.shipping.service = format(f.service.id);
        f.body.shipping.place = format(f.place.id);
        f.body.brand.id = format(f.brand.id);
        expect(schema.safeParse(f.body).success).toBe(true);
        await run(f);
        expect(await onlyDraft()).toMatchObject({
            category_id: f.category.id,
            item_condition_id: f.condition.id,
            shipping_day_id: f.day.id,
            shipping_service_id: f.service.id,
            shipping_place_id: f.place.id,
            brand_id: f.brand.id,
        });
    });
});

describe("P1: F4で入口を制限した後も保存先の制約を維持する", () => {
    it.each(["gender_type", "age_type"] as const)("D04 D09: %sのDB ENUMを直接SQLで検証", async (column) => {
        await run(f);
        const before = await onlyDraft();
        await expect(
            observer.query(`UPDATE item_draft SET ${column} = :value WHERE id = :id`, {
                replacements: { value: "invalid", id: before.id },
            }),
        ).rejects.toMatchObject({ parent: { code: "22P02" } });
        expect(await onlyDraft()).toEqual(before);
    });
    it.each(["name", "name_normalized"] as const)("D06: ブランド別名の%sはDBでも256文字を拒否", async (column) => {
        const name = `${f.prefix}dbconstraint`;
        const alias = await BrandAliases.create({ name, name_normalized: name, brand_id: null });
        const before = alias.toJSON();
        await expect(
            observer.query(`UPDATE brand_aliases SET ${column} = :value WHERE id = :id`, {
                replacements: { value: "あ".repeat(256), id: alias.id },
            }),
        ).rejects.toMatchObject({ parent: { code: "22001" } });
        expect((await BrandAliases.findByPk(alias.id))!.toJSON()).toEqual(before);
    });
});
