import {
    test,
    expect,
    openConfirm,
    submit,
    snapshot,
    authHeader,
} from "../../../../fixtures/item/itemConfirmPage/harness.js";
import type { Row } from "../../../../fixtures/item/itemConfirmPage/database.js";

test("E-N02 実更新は同じ商品・関連IDを保存し在庫をリセットする", async ({ page, context, baseURL, e2e }) => {
    await openConfirm(page, context, baseURL, e2e, "edit");
    const response = page.waitForResponse(
        (r) => r.request().method() === "PUT" && new URL(r.url()).pathname.endsWith("/items"),
    );
    await submit(page);
    const result = await response;
    expect(result.status()).toBe(201);
    expect(result.request().postDataJSON()).toEqual({ itemEditingId: e2e.seed.edit.id });
    expect(await result.json()).toEqual({ itemId: e2e.seed.item.id });
    await expect(page).toHaveURL(new RegExp(`/item/${e2e.seed.item.id}$`));
    await expect.soft(page.getByRole("heading", { level: 1, name: "確認用シャツ", exact: true })).toBeVisible();
    expect(await e2e.database.get("item_editing", e2e.seed.edit.id)).toBeNull();
    const items = (await e2e.database.db.query<Row>("SELECT * FROM item WHERE seller_id=$1", [e2e.seed.owner.id])).rows;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
        id: e2e.seed.item.id,
        name: "確認用シャツ",
        price: 12000,
        seller_id: e2e.seed.owner.id,
        video_id: e2e.seed.video.id,
        sale_id: e2e.seed.sale.id,
        shipping_id: e2e.seed.shipping.id,
        status: "active",
    });
    for (const column of [
        "name",
        "detail",
        "image_url",
        "price",
        "item_condition_id",
        "first_image_url",
        "gender_type",
        "age_type",
        "recommend",
        "category_id",
        "brand_id",
        "brand_aliases_id",
    ])
        expect(items[0][column], column).toEqual(e2e.seed.edit[column]);
    expect(items[0].attributes).toMatchObject({
        inventory: { initial: 10, current: 10 },
        colorVariants: [{ inventory: { current: 5 }, sizes: [{ inventory: { current: 5 } }] }],
    });
    expect(
        (await e2e.database.db.query<Row>("SELECT * FROM video WHERE id=$1", [e2e.seed.video.id])).rows[0],
    ).toMatchObject({ title: "確認動画", original_url: "/test-confirm.mp4", summary: "確認動画の概要" });
    expect(
        (await e2e.database.db.query<Row>("SELECT * FROM sale WHERE id=$1", [e2e.seed.sale.id])).rows[0],
    ).toMatchObject({ sale_flag: false, before_price: 15000, discount_rate: null, discount_amount: null });
    const shipping = (
        await e2e.database.db.query<Row>("SELECT * FROM item_shipping_profile WHERE id=$1", [e2e.seed.shipping.id])
    ).rows[0];
    for (const column of ["shipping_day_id", "shipping_service_id", "shipping_place_id", "shipping_service_free_text"])
        expect(shipping[column], column).toEqual(e2e.seed.edit[column]);
    expect(await e2e.database.get("item_editing", e2e.seed.normal.id)).toEqual(e2e.seed.normal);
    await e2e.expectProtected();
});

for (const mode of ["normal", "edit"] as const) {
    test(`E-E02 ${mode}表示後に編集元を削除すると拒否し部分保存しない`, async ({ page, context, baseURL, e2e }) => {
        await openConfirm(page, context, baseURL, e2e, mode);
        const editing = mode === "normal" ? e2e.seed.normal : e2e.seed.edit;
        await e2e.database.db.query("DELETE FROM item_editing WHERE id=$1", [editing.id]);
        const before = await snapshot(e2e);
        const response = page.waitForResponse(
            (r) =>
                r.request().method() === (mode === "normal" ? "POST" : "PUT") &&
                new URL(r.url()).pathname.endsWith("/items"),
        );
        await submit(page);
        expect((await response).status()).toBe(404);
        await expect(
            page.getByText("サーバーエラーが発生しました。通信状況を確認し、もう一度ボタンをクリックしてください", {
                exact: true,
            }),
        ).toBeVisible();
        expect(await snapshot(e2e)).toEqual(before);
        await expect(page).toHaveURL(new RegExp(`/item/confirm/${mode === "edit" ? "edit/" : ""}${editing.id}$`));
    });
    test(`E-E01 ${mode}他人・不正IDへ改変した直接要求は拒否しDB不変`, async ({ page, context, baseURL, e2e }) => {
        await openConfirm(page, context, baseURL, e2e, mode);
        const headers = await authHeader(context);
        for (const id of [e2e.seed.otherEditing.id, 0]) {
            const before = await snapshot(e2e);
            const result = await e2e.http("/items", {
                method: mode === "normal" ? "POST" : "PUT",
                headers,
                body: JSON.stringify({ itemEditingId: id }),
            });
            expect(result.status).toBe(id === 0 ? 400 : 404);
            expect(await snapshot(e2e)).toEqual(before);
        }
    });
    test(`E-O01 ${mode}二タブ送信・再送の実API結果と重複件数を観測`, async ({ page, context, baseURL, e2e }, info) => {
        await openConfirm(page, context, baseURL, e2e, mode);
        const second = await context.newPage();
        const editing = mode === "normal" ? e2e.seed.normal : e2e.seed.edit;
        await second.goto(page.url());
        const match = (r: import("@playwright/test").Response) =>
            r.request().method() === (mode === "normal" ? "POST" : "PUT") &&
            new URL(r.url()).pathname.endsWith("/items");
        const firstResponse = page.waitForResponse(match);
        const secondResponse = second.waitForResponse(match);
        await Promise.all([submit(page), submit(second)]);
        const statuses = [(await firstResponse).status(), (await secondResponse).status()];
        const headers = await authHeader(context);
        const resend = await e2e.http("/items", {
            method: mode === "normal" ? "POST" : "PUT",
            headers,
            body: JSON.stringify({ itemEditingId: editing.id }),
        });
        const count = (
            await e2e.database.db.query<{ count: string }>("SELECT count(*) FROM item WHERE seller_id=$1", [
                e2e.seed.owner.id,
            ])
        ).rows[0].count;
        await info.attach("E-O01-observation", {
            body: JSON.stringify({ statuses, resend: resend.status, count }),
            contentType: "application/json",
        });
        // Contract: one consumed editing session must not create duplicate products.
        expect(Number(count)).toBe(mode === "normal" ? 2 : 1);
        expect(await e2e.database.get("item_editing", editing.id)).toBeNull();
        await second.close();
    });
}
