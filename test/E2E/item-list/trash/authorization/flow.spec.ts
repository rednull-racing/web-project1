import { test, expect, listURL, authHeader } from "../../../../fixtures/item-list/trash/harness.js";
test("E-S01 sessionなしはloginへ、tokenなしGETは401で一覧情報を返さない", async ({ page, context, trash }) => {
    await page.goto(listURL);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.locator('a[href^="/item/deleted/"]')).toHaveCount(0);
    await trash.login(context);
    await page.goto(listURL);
    await expect(page.getByPlaceholder("検索")).toBeVisible();
    await context.clearCookies({ name: "access-token" });
    const result = await page.evaluate(async (api) => {
        const response = await fetch(`${api}/item-trash/list?page=1`);
        return { status: response.status, body: await response.json() };
    }, trash.api);
    expect(result.status).toBe(401);
    expect(result.body).not.toHaveProperty("itemTrashList");
    await trash.unchanged();
});
test("E-S02 queryのseller_id偽装でも他人と所有者nullの行を取得できない", async ({ page, context, trash }) => {
    await trash.login(context);
    await page.goto(listURL);
    await expect(page.getByPlaceholder("検索")).toBeVisible();
    const result = await context.request.get(`${trash.api}/item-trash/list?page=1&seller_id=${trash.seed.other}`, {
        headers: await authHeader(context),
    });
    expect(result.status()).toBe(200);
    const body = (await result.json()) as { itemTrashList: { itemTrash: { id: number } }[]; totalPages: number };
    const ids = body.itemTrashList.map((entry) => entry.itemTrash.id);
    expect(body.totalPages).toBe(2);
    expect(ids).toHaveLength(20);
    for (const id of ids) expect(trash.seed.rows.slice(0, 21).some((row) => row.id === id)).toBe(true);
    expect(ids).not.toContain(trash.seed.rows[21].id);
    expect(ids).not.toContain(trash.seed.rows[22].id);
    await trash.unchanged();
});
