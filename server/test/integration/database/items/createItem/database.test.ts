import { describe, expect, it } from "vitest";
import { seed, run, snapshot, assertProtected, assertRolledBack, notification, Item, Video, Sale, ItemShippingProfile, ids, Follow } from "../../../../fixtures/items/createItem/databaseFixtures.js";
import { expectedAttributes, requiredIdFields, nullableBrandCases } from "../../../../fixtures/items/createItem/fixtures.js";
describe("D 実PostgreSQL保存と所有権", () => {
    it("D01 D06 D07 N01 N02 N03 N09 I01 I12: 新規4行・全コピー・再送404・保護行維持", async () => {
        const f = await seed();
        const id = await run(f);
        const item = await snapshot("item", id);
        expect(item).not.toBeNull();
        for (const key of ["name", "detail", "image_url", "price", "item_condition_id", "seller_id", "first_image_url", "gender_type", "age_type", "recommend", "category_id", "brand_id", "brand_aliases_id"] as const)
            expect(item![key]).toEqual(f.editing[key]);
        expect(item).toMatchObject({ attributes: expectedAttributes(), status: "active", views_count: 0, early_sell: true, checked: false, search_text: "testかたかなvideoてすとしゃつtopsuser" });
        expect(Number(item!.report_score)).toBe(0);
        expect(Number(item!.sort_number)).toBe(6255);
        expect(Number(item!.sort_buzz_number)).toBe(6255);
        expect(item!.uploaded_at).toEqual(item!.save_at);
        expect(await snapshot("video", Number(item!.video_id))).toMatchObject({ thumbnail_url: f.editing.thumbnail_url, title: f.editing.title, summary: f.editing.summary, duration: 30, play_count: 0, original_url: f.editing.original_url, converted_url: f.editing.converted_url, status: f.editing.video_status });
        expect(await snapshot("sale", Number(item!.sale_id))).toMatchObject({ before_price: 15000, discount_rate: null, discount_amount: null, sale_flag: false });
        expect(await snapshot("item_shipping_profile", Number(item!.shipping_id))).toMatchObject({ shipping_day_id: f.editing.shipping_day_id, shipping_service_id: f.editing.shipping_service_id, shipping_place_id: f.editing.shipping_place_id, shipping_service_free_text: "配送備考" });
        expect(await snapshot("item_editing", f.editing.id)).toBeNull();
        for (const model of [Item, Video, Sale, ItemShippingProfile])
            expect(ids(model)).toHaveLength(2);
        expect(notification).toHaveBeenCalledTimes(1);
        notification.mockClear();
        await expect(run(f)).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(notification).not.toHaveBeenCalled();
        await assertProtected(f);
    });
    it.each(["other", "missing", "null-owner"])("E01 D06: %sは404・非対象不変", async (mode) => {
        const f = await seed();
        if (mode === "null-owner")
            await f.editing.update({ seller_id: null });
        const before = await snapshot("item_editing", f.editing.id);
        await expect(run(f, mode === "other" ? f.otherEditing.id : mode === "missing" ? 2147483647 : f.editing.id)).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        await assertRolledBack(f, before);
    });
    it.each(requiredIdFields)("AF-ID01 AF-ID02: %s=null拒否後、修復した同IDで成功", async (field) => { const f = await seed(); const original = f.editing[field]; await f.editing.update({ [field]: null }); const before = await snapshot("item_editing", f.editing.id); await expect(run(f)).rejects.toMatchObject({ code: "INVALID_NUMBER", statusCode: 400 }); await assertRolledBack(f, before); await f.editing.update({ [field]: original }); expect(await run(f)).toBeTypeOf("number"); expect(notification).toHaveBeenCalledTimes(1); });
    it.each([
        ["B02", { original_url: null }, "VIDEO_URL_NULL", 400], ["B03", { thumbnail_url: "" }, "THUMBNAIL_URL_NULL", 400], ["B04", { image_url: [] }, "ITEM_IMAGE_NULL", 400],
        ["B05", { price: 299 }, "ITEM_PUBLISH_DATA_INVALID", 400], ["B06", { title: null }, "ITEM_PUBLISH_DATA_INVALID", 400], ["B07", { first_image_url: null }, "ITEM_PUBLISH_DATA_INVALID", 400],
        ["I05", { attributes: [] }, "ITEM_ATTRIBUTES_INVALID", 500], ["I06", { attributes: { colorVariants: null } }, "ITEM_ATTRIBUTES_INVALID", 500], ["I08", { attributes: { colorVariants: [{ sizes: [{}] }] } }, "ITEM_ATTRIBUTES_INVALID", 500],
        ["I09", { attributes: { inventory: { initial: 1, current: "1", low_stock_ratio: 0.2 } } }, "ITEM_ATTRIBUTES_INVALID", 500], ["I10", { attributes: { inventory: { initial: -1, current: 0, low_stock_ratio: 0.2 } } }, "ITEM_PUBLISH_DATA_INVALID", 400],
    ] as const)("%s: 保存済み%jは%s・rollback", async (_case, patch, code, statusCode) => { const f = await seed(); await f.editing.update(patch); const before = await snapshot("item_editing", f.editing.id); await expect(run(f)).rejects.toMatchObject({ code, statusCode }); await assertRolledBack(f, before); });
    it("D05 S05 S06: 集計は既存active/soldoutとfollower方向、自己加算なし", async () => { const f = await seed(); await Item.create({ seller_id: f.owner.id, status: "active", uploaded_at: new Date() }); await Item.create({ seller_id: f.other.id, status: "active", uploaded_at: new Date() }); await Follow.create({ follow_user_id: f.other.id, follower_user_id: f.owner.id }); await Follow.create({ follow_user_id: f.owner.id, follower_user_id: f.other.id }); const id = await run(f); expect(Number((await snapshot("item", id))!.sort_number)).toBe(6275); await assertProtected(f); });
});

it.each(nullableBrandCases)("AF-BR02: 保存済みbrand/alias null %jは新規商品へそのまま保存",async patch=>{
    const f=await seed();await f.editing.update(patch);const id=await run(f);const item=await snapshot("item",id);
    expect(item!.brand_id).toBe(f.editing.brand_id);expect(item!.brand_aliases_id).toBe(f.editing.brand_aliases_id);
    expect(await snapshot("item_editing",f.editing.id)).toBeNull();expect(notification).toHaveBeenCalledTimes(1);await assertProtected(f);
});
