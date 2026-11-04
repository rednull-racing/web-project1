import { test, expect, api, login } from './browser';
export const uploadCases = (mode: 'normal' | 'edit') => {
    const path = (id: string | number) => `/upload/${mode === 'edit' ? 'edit/' : ''}${id}`;
    test(`P01 ${mode} 未認証GET未実行`, async ({ page, id, put, request }) => { await put(); await page.goto(path(id)); await expect(page).toHaveURL(/\/login/); const state = await (await request.get(`${api}/__test__/state`)).json(); expect(state[id].requests).toBe(0); });
    test(`P01 ${mode} 他人フォーム非公開`, async ({ page, context, baseURL, id, put }) => { await put({ seller: 8 }); await login(context, baseURL!); await page.goto(path(id)); await expect(page).toHaveURL(/\/upload\/before/); await expect(page.getByPlaceholder('商品名（50文字以内）')).toHaveCount(0); });
    for (const nullable of [false, true])
        test(`P01 P03 ${mode} nullable=${nullable}`, async ({ page, context, baseURL, id, put, errors }) => { await put({ nullable }); await login(context, baseURL!); expect((await page.goto(path(id)))?.status()).toBe(200); await expect(page.getByRole('button', { name: '出品する', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: '下書き保存する', exact: true })).toHaveCount(mode === 'normal' ? 1 : 0); await expect(page.getByPlaceholder('商品名（50文字以内）')).toHaveValue(nullable ? '' : 'テストシャツ'); await expect(page).toHaveTitle(mode === 'normal' ? '商品を出品する' : '商品を編集する'); await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex.*nofollow/); expect(errors).toEqual([]); });
    for (const status of [401, 404, 400, 403, 429, 500])
        test(`P02 ${mode} GET ${status}`, async ({ page, context, baseURL, id, put }) => { await put({ status }); await login(context, baseURL!); await page.goto(path(id)); if (status === 401)
            await expect(page).toHaveURL(/\/login/);
        else if (status === 404)
            await expect(page.getByText('This page could not be found.')).toBeVisible();
        else
            await expect(page.getByRole('heading', { name: 'エラーが発生しました' })).toBeVisible(); await expect(page.getByRole('button', { name: '出品する', exact: true })).toHaveCount(0); });
    for (const raw of ['not-json', 'Too many requests'])
        test(`P02 ${mode} 非JSON ${raw}`, async ({ page, context, baseURL, id, put }) => { await put({ status: 429, raw }); await login(context, baseURL!); await page.goto(path(id)); await expect(page.getByRole('heading', { name: 'エラーが発生しました' })).toBeVisible(); });
    test(`P02 ${mode} 切断`, async ({ page, context, baseURL, id, put }) => { await put({ disconnect: true }); await login(context, baseURL!); await page.goto(path(id)); await expect(page.getByRole('heading', { name: 'エラーが発生しました' })).toBeVisible(); });
    for (const invalid of ['0', '-1', '1.5', 'abc', '2147483648'])
        test(`P04 ${mode} ID ${invalid}`, async ({ page, context, baseURL, request }) => { await request.post(`${api}/__test__/form`, { data: { id: invalid, status: 400 } }); await login(context, baseURL!); await page.goto(path(invalid)); await expect(page.getByRole('heading', { name: 'エラーが発生しました' })).toBeVisible(); });
};
