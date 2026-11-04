import { test, expect } from '../../../../fixtures/item/itemConfirmPage/harness.js';
test('D02 保存でediting削除とdraft値確認', async ({ page, context, baseURL, e2e }) => {
    await e2e.login(context, baseURL!);
    const editing = e2e.seed.normal;
    await e2e.database.db.query('UPDATE item_editing SET attributes=$1 WHERE id=$2', [JSON.stringify({ inventory: { initial: 1, current: 1 }, colorVariants: [], materials: [] }), editing.id]);
    await page.goto(`/upload/${editing.id}`);
    await page.getByPlaceholder('商品名（50文字以内）').fill('下書き保存したシャツ');
    const pending = page.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname.endsWith('/item-draft'));
    await page.getByRole('button', { name: '下書き保存する', exact: true }).click();
    const response = await pending;
    await test.info().attach('D02-response', { body: JSON.stringify({ status: response.status(), body: await response.json() }), contentType: 'application/json' });
    expect(response.status()).toBe(201);
    expect(await e2e.database.get('item_editing', editing.id)).toBeNull();
    expect((await e2e.database.db.query('SELECT * FROM item_draft WHERE seller_id=$1 AND name=$2', [e2e.seed.owner.id, '下書き保存したシャツ'])).rows).toHaveLength(1);
    await e2e.expectProtected();
});
