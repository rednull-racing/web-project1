import { test, expect, openConfirm, submit } from "../../../../fixtures/item/itemConfirmPage/harness.js";
import type { Row } from "../../../../fixtures/item/itemConfirmPage/database.js";

test("E-N01 実出品を保存し編集元を消費、在庫と関連を整合させる", async ({ page, context, baseURL, e2e }) => {
    await openConfirm(page, context, baseURL, e2e, "normal");
    const response = page.waitForResponse(r => r.request().method() === "POST" && new URL(r.url()).pathname.endsWith("/items"));
    await submit(page);
    const result = await response;
    expect(result.status()).toBe(201);
    expect(result.request().postDataJSON()).toEqual({ itemEditingId: e2e.seed.normal.id });
    const { itemId } = await result.json() as { itemId: number };
    await expect(page).toHaveURL(new RegExp(`/upload/ok/${itemId}$`));
    await expect.soft(page.getByText("出品が完了しました", { exact: true })).toBeVisible();
    expect(await e2e.database.get("item_editing", e2e.seed.normal.id)).toBeNull();
    const item = (await e2e.database.db.query<Row>("SELECT * FROM item WHERE id=$1", [itemId])).rows[0];
    expect(item).toMatchObject({ name: "確認用シャツ", detail: "確認商品の説明", price: 12000, seller_id: e2e.seed.owner.id, status: "active", views_count: 0 });
    for (const column of ["name", "detail", "image_url", "price", "item_condition_id", "first_image_url", "gender_type", "age_type", "recommend", "category_id", "brand_id", "brand_aliases_id"])
        expect(item[column], column).toEqual(e2e.seed.normal[column]);
    expect(item.attributes).toMatchObject({ inventory: { initial: 10, current: 10 }, colorVariants: [{ inventory: { initial: 5, current: 5 }, sizes: [{ inventory: { initial: 5, current: 5 } }] }] });
    const video = (await e2e.database.db.query<Row>("SELECT * FROM video WHERE id=$1", [item.video_id])).rows[0];
    expect(video).toMatchObject({ title: "確認動画", summary: "確認動画の概要", original_url: "/test-confirm.mp4", play_count: 0 });
    const sale = (await e2e.database.db.query<Row>("SELECT * FROM sale WHERE id=$1", [item.sale_id])).rows[0];
    expect(sale).toMatchObject({ before_price: 15000, sale_flag: false, discount_rate: null, discount_amount: null });
    const shipping = (await e2e.database.db.query<Row>("SELECT * FROM item_shipping_profile WHERE id=$1", [item.shipping_id])).rows[0];
    for (const column of ["shipping_day_id", "shipping_service_id", "shipping_place_id", "shipping_service_free_text"])
        expect(shipping[column], column).toEqual(e2e.seed.normal[column]);
    expect((await e2e.database.db.query<Row>("SELECT * FROM item WHERE id=$1", [e2e.seed.item.id])).rows[0]).toEqual(e2e.seed.item);
    await e2e.expectProtected();
});
