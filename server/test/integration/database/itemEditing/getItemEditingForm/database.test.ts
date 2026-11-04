import "../../../../fixtures/itemEditing/getItemConfirmPage/databaseSetup.js";
import { describe, expect, it } from "vitest";
import {
    seed,
    snapshot,
    Categories,
    ItemEditing,
    ShopInfo,
} from "../../../../fixtures/itemEditing/getItemEditingForm/databaseFixtures.js";
import { getItemEditingFormUseCase } from "../../../../../src/usecases/itemEditing/getItemEditingForm.js";
import { AppError } from "../../../../../src/errors.js";
import {
    ItemConditionOption,
    ShippingDayOption,
    ShippingServiceOption,
    TodouhukenOption,
} from "../../../../../src/models/index.js";

const json = (value: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

describe("getItemEditingForm 実DB 所有者限定・公開列・参照不変 P0", () => {
    it("DB01 F10 関連のlevelを含む保存値を返し、ID・duration数値を保持する", async () => {
        const f = await seed();
        const before = await snapshot();
        const result = await getItemEditingFormUseCase({ itemEditingId: f.editing.id, userId: f.owner.id });
        expect(json(result.itemEditing)).toEqual({
            id: f.editing.id,
            status: "normal",
            seller_id: f.owner.id,
            name: "確認商品",
            detail: "説明",
            price: 3000,
            image_url: ["https://media.test/first.jpg", "https://media.test/second.jpg"],
            first_image_url: "https://media.test/first.jpg",
            gender_type: "unisex",
            age_type: "both",
            attributes: {
                inventory: { initial: 5, current: 2, low_stock_ratio: 0.5 },
                materials: [{ name: "綿", ratio: 100 }],
            },
            thumbnail_url: "https://media.test/thumb.jpg",
            title: "題名",
            summary: "要約",
            duration: 17,
            original_url: "https://media.test/original.mp4",
            converted_url: "https://media.test/index.m3u8",
            video_status: "converted",
            before_price: 4000,
            shipping_service_free_text: "配送備考",
            Category: {
                id: f.category.id,
                level: 2,
                name: "カテゴリー",
                allowed_gender: "unisex", allowed_age: "both", parent_id: f.parent.id,
                parent: { id: f.parent.id, name: "親", level: 1, allowed_gender: "unisex", allowed_age: "both", parent_id: null },
                children: [{ id: f.child.id, name: "子", level: 3, allowed_gender: "unisex", allowed_age: "both", parent_id: f.category.id }],
            },
            Brand: { id: f.brand.id, name: f.brand.name },
            ItemConditionOption: { id: f.condition.id, name: "新品" },
            ShippingDayOption: { id: f.day.id, name: "翌日" },
            ShippingServiceOption: { id: f.service.id, name: "配送" },
            TodouhukenOption: { id: f.place.id, name: "東京都" },
        });
        expect(await snapshot()).toEqual(before);
    });
    it.each(["processing", "converted", "failed"])("F9 変換状態%sを所有者に返しDBを変更しない", async (video_status) => {
        const f = await seed();
        await f.editing.update({ video_status });
        const before = await snapshot();
        const data = json((await getItemEditingFormUseCase({ itemEditingId: f.editing.id, userId: f.owner.id })).itemEditing);
        expect(data).toMatchObject({ id: f.editing.id, video_status });
        expect(await snapshot()).toEqual(before);
    });

    it("DB02 edit状態・任意関連なし・nullable列はnullのまま取得できる", async () => {
        const f = await seed();
        const data = json((await getItemEditingFormUseCase({ itemEditingId: f.empty.id, userId: f.owner.id })).itemEditing);
        expect(data.status).toBe("edit");
        for (const key of [
            "name",
            "detail",
            "price",
            "image_url",
            "first_image_url",
            "thumbnail_url",
            "title",
            "summary",
            "duration",
            "original_url",
            "converted_url",
            "video_status",
            "before_price",
            "shipping_service_free_text",
            "Category",
            "Brand",
            "ItemConditionOption",
            "ShippingDayOption",
            "ShippingServiceOption",
            "TodouhukenOption",
        ])
            expect(data[key], key).toBeNull();
        expect(data.attributes).toEqual({});
        for (const key of [
            "item_id",
            "updatedAt",
            "createdAt",
            "category_id",
            "recommend",
            "sale_flag",
        ])
            expect(data).not.toHaveProperty(key);
    });
    it.each(["otherEditing", "ownerless", "missingId"] as const)("DB03 %sは同じ404で全行不変", async (target) => {
        const f = await seed();
        const before = await snapshot();
        const itemEditingId = target === "missingId" ? f.missingId : f[target].id;
        const result = getItemEditingFormUseCase({ itemEditingId, userId: f.owner.id });
        await expect(result).rejects.toBeInstanceOf(AppError);
        await expect(result).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(await snapshot()).toEqual(before);
    });
    it("DB05 Category親なし・子なし、空画像配列・durationゼロを保持する", async () => {
        const f = await seed();
        const root = await Categories.create({
            name: "単独カテゴリー",
            level: 1,
            path: `confirm-boundary-${f.editing.id}`,
            layer: "middle",
        });
        const editing = await ItemEditing.create({
            seller_id: f.owner.id,
            category_id: root.id,
            image_url: [],
            duration: 0,
        });
        const before = await snapshot();
        const data = json((await getItemEditingFormUseCase({ itemEditingId: editing.id, userId: f.owner.id })).itemEditing);
        expect(data.Category).toEqual({ id: root.id, name: "単独カテゴリー", level: 1, allowed_gender: "unisex", allowed_age: "both", parent_id: null, parent: null, children: [] });
        expect(data.image_url).toEqual([]);
        expect(data.duration).toBe(0);
        expect(await snapshot()).toEqual(before);
    });
    it("DB04 再送・並行参照で別対象の結果が混ざらず全行不変", async () => {
        const f = await seed();
        const before = await snapshot();
        const run = (itemEditingId: number, userId: number) => getItemEditingFormUseCase({ itemEditingId, userId });
        const first = json(await run(f.editing.id, f.owner.id));
        expect(json(await run(f.editing.id, f.owner.id))).toEqual(first);
        const settled = await Promise.allSettled([
            run(f.editing.id, f.owner.id),
            run(f.otherEditing.id, f.other.id),
            run(f.empty.id, f.owner.id),
        ]);
        const results = settled.map((result) => {
            if (result.status === "rejected") throw result.reason;
            return result.value;
        });
        expect(results.map((result) => json(result.itemEditing).id)).toEqual([f.editing.id, f.otherEditing.id, f.empty.id]);
        expect(await snapshot()).toEqual(before);
    });
    it("DB06 更新後の次回取得は最新保存値、削除後は404を返す", async () => {
        const f = await seed();
        const run = () => getItemEditingFormUseCase({ itemEditingId: f.editing.id, userId: f.owner.id });
        expect(json((await run()).itemEditing).name).toBe("確認商品");
        await f.editing.update({ name: "更新後フォーム商品", image_url: [] });
        const before = await snapshot();
        expect(json((await run()).itemEditing)).toMatchObject({ name: "更新後フォーム商品", image_url: [] });
        expect(await snapshot()).toEqual(before);
        await f.editing.destroy();
        const deleted = await snapshot();
        await expect(run()).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(await snapshot()).toEqual(deleted);
    });
});

describe("P0 追加選択肢と認証ユーザーのショップ有無", () => {
    it("DB07 level1全カラムと選択肢全件を返しカテゴリーをsort_order順にする", async () => {
        const f = await seed();
        await f.parent.update({ sort_order: 20 });
        const first = await Categories.create({ name: "先頭", level: 1, path: `form-first-${f.editing.id}`, layer: "outer", sort_order: 10, allowed_gender: "women", allowed_age: "adult" });
        const before = await snapshot();
        const result = await getItemEditingFormUseCase({ itemEditingId: f.editing.id, userId: f.owner.id });
        expect(Object.keys(result).sort()).toEqual(["allCondition", "allDay", "allPlace", "allService", "category", "hasShop", "itemEditing"]);
        expect(result.category.every((row) => row.level === 1)).toBe(true);
        expect(result.category).toHaveLength(await Categories.count({ where: { level: 1 } }));
        expect(result.category.filter((row) => [first.id, f.parent.id].includes(row.id)).map((row) => json(row))).toEqual([json(first), json(f.parent)]);
        expect(result.category.map((row) => row.sort_order)).toEqual(result.category.map((row) => row.sort_order).sort((a, b) => a - b));
        for (const [rows, row] of [[result.allCondition, f.condition], [result.allDay, f.day], [result.allService, f.service], [result.allPlace, f.place]] as const) {
            expect(rows.map((value) => json(value))).toContainEqual(json(row));
        }
        expect(result.allCondition).toHaveLength(await ItemConditionOption.count());
        expect(result.allDay).toHaveLength(await ShippingDayOption.count());
        expect(result.allService).toHaveLength(await ShippingServiceOption.count());
        expect(result.allPlace).toHaveLength(await TodouhukenOption.count());
        expect(result.hasShop).toBe(false);
        expect(await snapshot()).toEqual(before);
    });
    it("DB08 他ユーザーの承認ショップは混入せず、自分の未承認はfalse・承認後はtrue", async () => {
        const f = await seed();
        await ShopInfo.create({ user_id: f.other.id, verified: true, shop_name: "他人のショップ" });
        const run = () => getItemEditingFormUseCase({ itemEditingId: f.editing.id, userId: f.owner.id });
        let before = await snapshot();
        expect((await run()).hasShop).toBe(false);
        expect(await snapshot()).toEqual(before);
        const shop = await ShopInfo.create({ user_id: f.owner.id, verified: false, shop_name: "自分のショップ" });
        before = await snapshot();
        expect((await run()).hasShop).toBe(false);
        expect(await snapshot()).toEqual(before);
        await shop.update({ verified: true });
        before = await snapshot();
        const result = await run();
        expect(result.hasShop).toBe(true);
        expect(result).not.toHaveProperty("userHasShop");
        expect(await snapshot()).toEqual(before);
    });
});
