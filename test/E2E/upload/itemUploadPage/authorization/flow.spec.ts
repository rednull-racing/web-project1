import { test, expect, authHeader, snapshot } from '../../../../fixtures/item/itemConfirmPage/harness.js';
test('D03 有効bodyで他人のPUT/POSTと未認証・不正IDを拒否しDB不変', async ({ page, context, baseURL, e2e }) => {
    await e2e.login(context, baseURL!);
    await page.goto(`/upload/${e2e.seed.normal.id}`);
    const headers = await authHeader(context);
    const row = e2e.seed.normal;
    const body = {
        video: { name: 'old.mp4', uploaded: true }, thumbnail: { name: 'old.jpg', uploaded: true },
        videoMeta: { title: '認可検証', summary: null }, itemImages: [{ name: 'old.jpg', type: null, uploaded: true }],
        itemMeta: { name: '認可検証', detail: null },
        category: { id: String(row.category_id), name: 'カテゴリー', parent_id: null, level: 1 },
        genderAge: { gender: 'men', age: 'adult' }, brand: { id: String(row.brand_id), name: 'ブランド' },
        attributes: { allInventory: 1, colorVariants: [], materials: [] },
        condition: { id: String(row.item_condition_id), name: '新品' },
        shipping: { day: String(row.shipping_day_id), service: String(row.shipping_service_id), place: String(row.shipping_place_id), freeText: null }, price: 1000,
    };
    const before = await snapshot(e2e);
    for (const id of [e2e.seed.otherEditing.id, 0]) {
        const get = await e2e.http(`/item-editing/${id}/form?userId=${e2e.seed.other.id}&seller_id=${e2e.seed.other.id}`, { headers });
        expect(get.status).toBe(id === 0 ? 400 : 404);
        expect(await get.text()).not.toContain('他人の編集');
        const put = await e2e.http(`/item-editing/${id}`, { method: 'PUT', headers, body: JSON.stringify({ ...body, seller_id: e2e.seed.other.id }) });
        expect(put.status).toBe(id === 0 ? 400 : 404);
        const post = await e2e.http('/item-draft', { method: 'POST', headers, body: JSON.stringify({ ...body, itemEditingId: id, seller_id: e2e.seed.other.id }) });
        expect(post.status).toBe(id === 0 ? 400 : 404);
        expect(await snapshot(e2e)).toEqual(before);
    }
    expect((await e2e.http(`/item-editing/${e2e.seed.normal.id}/form`)).status).toBe(401);
    expect(await snapshot(e2e)).toEqual(before);
    await e2e.expectProtected();
});
