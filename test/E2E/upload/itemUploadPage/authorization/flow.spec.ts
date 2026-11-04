import { test, expect, authHeader, snapshot } from '../../../../fixtures/item/itemConfirmPage/harness.js';
test('D03 所有者偽装・未認証・不正IDを拒否しDB不変', async ({ page, context, baseURL, e2e }) => {
    await e2e.login(context, baseURL!);
    await page.goto(`/upload/${e2e.seed.normal.id}`);
    const headers = await authHeader(context);
    const before = await snapshot(e2e);
    for (const id of [e2e.seed.otherEditing.id, 0]) {
        const response = await e2e.http(`/item-editing/${id}/form?userId=${e2e.seed.other.id}&seller_id=${e2e.seed.other.id}`, { headers });
        expect(response.status).toBe(id === 0 ? 400 : 404);
        expect(await response.text()).not.toContain('他人の編集');
        for (const suffix of ['', '/convert']) {
            const rejected = await e2e.http(`/item-editing/${id}${suffix}`, { method: suffix ? 'PATCH' : 'PUT', headers, body: suffix ? undefined : JSON.stringify({ seller_id: e2e.seed.other.id }) });
            expect([400, 404]).toContain(rejected.status);
        }
    }
    expect((await e2e.http(`/item-editing/${e2e.seed.normal.id}/form`)).status).toBe(401);
    expect(await snapshot(e2e)).toEqual(before);
    await e2e.expectProtected();
});
