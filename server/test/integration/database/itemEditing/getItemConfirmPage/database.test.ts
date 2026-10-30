import "../../../../fixtures/itemEditing/getItemConfirmPage/databaseSetup.js";
import { describe, expect, it } from "vitest";
import { seed, snapshot } from "../../../../fixtures/itemEditing/getItemConfirmPage/databaseFixtures.js";
import { getItemConfirmPageUseCase } from "../../../../../src/usecases/itemEditing/getItemConfirmPage.js";
import { AppError } from "../../../../../src/errors.js";

const json = (value: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(value)) as Record<string, unknown>;

describe("getItemConfirmPage 実DB 所有者限定・公開列・参照不変 P0", () => {
    it("DB01 関連ありの保存値を公開列だけ返し、日時ISO/ID・duration数値を保持する", async () => {
        const f = await seed();
        const before = await snapshot();
        const result = await getItemConfirmPageUseCase({ itemEditingId: f.editing.id, userId: f.owner.id });
        expect(json(result)).toEqual({
            id: f.editing.id, status: "normal", item_id: null, seller_id: f.owner.id, name: "確認商品", detail: "説明", price: 3000,
            image_url: ["https://media.test/first.jpg", "https://media.test/second.jpg"], first_image_url: "https://media.test/first.jpg",
            gender_type: "unisex", age_type: "both", recommend: true,
            attributes: { inventory: { initial: 5, current: 2, low_stock_ratio: 0.5 }, materials: [{ name: "綿", ratio: 100 }] },
            thumbnail_url: "https://media.test/thumb.jpg", title: "題名", summary: "要約", duration: 17,
            original_url: "https://media.test/original.mp4", converted_url: "https://media.test/index.m3u8",
            before_price: 4000, discount_rate: 25, discount_amount: 1000, sale_flag: true, shipping_service_free_text: "配送備考",
            updatedAt: "2026-01-02T03:04:05.000Z",
            Category: { id: f.category.id, name: "カテゴリー", parent: { id: f.parent.id, name: "親" }, children: [{ id: f.child.id, name: "子" }] },
            Brand: { id: f.brand.id, name: f.brand.name }, ItemConditionOption: { id: f.condition.id, name: "新品" },
            ShippingDayOption: { id: f.day.id, name: "翌日" }, ShippingServiceOption: { id: f.service.id, name: "配送" },
            TodouhukenOption: { id: f.place.id, name: "東京都" },
        });
        expect(await snapshot()).toEqual(before);
    });
    it("DB02 edit状態・任意関連なし・nullable列はnullのまま取得できる", async () => {
        const f = await seed();
        const data = json(await getItemConfirmPageUseCase({ itemEditingId: f.empty.id, userId: f.owner.id }));
        expect(data.status).toBe("edit");
        for (const key of ["item_id", "name", "detail", "price", "image_url", "first_image_url", "recommend", "thumbnail_url", "title", "summary", "duration", "original_url", "converted_url", "before_price", "discount_rate", "discount_amount", "shipping_service_free_text", "Category", "Brand", "ItemConditionOption", "ShippingDayOption", "ShippingServiceOption", "TodouhukenOption"])
            expect(data[key], key).toBeNull();
        expect(data.attributes).toEqual({});
    });
    it.each(["otherEditing", "ownerless", "missingId"] as const)("DB03 %sは同じ404で全行不変", async (target) => {
        const f = await seed();
        const before = await snapshot();
        const itemEditingId = target === "missingId" ? f.missingId : f[target].id;
        const result = getItemConfirmPageUseCase({ itemEditingId, userId: f.owner.id });
        await expect(result).rejects.toBeInstanceOf(AppError);
        await expect(result).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(await snapshot()).toEqual(before);
    });
    it("DB04 再送・並行参照で別対象の結果が混ざらず全行不変", async () => {
        const f = await seed();
        const before = await snapshot();
        const run = (itemEditingId: number, userId: number) => getItemConfirmPageUseCase({ itemEditingId, userId });
        const first = json(await run(f.editing.id, f.owner.id));
        expect(json(await run(f.editing.id, f.owner.id))).toEqual(first);
        const results = await Promise.all([run(f.editing.id, f.owner.id), run(f.otherEditing.id, f.other.id), run(f.empty.id, f.owner.id)]);
        expect(results.map((result) => json(result).id)).toEqual([f.editing.id, f.otherEditing.id, f.empty.id]);
        expect(await snapshot()).toEqual(before);
    });
});
