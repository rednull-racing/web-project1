import { test, expect, listURL, authHeader } from "../../../../fixtures/item-list/trash/harness.js";

test("E-N01 本人21件のwire一覧と画面を20件ずつ正しい順序で表示する", async ({ page, context, trash }) => {
    await trash.login(context);
    const response = page.waitForResponse((r) => r.url().includes("/item-trash/list?page=1"));
    await page.goto(listURL);
    const result = await response;
    expect(result.status()).toBe(200);
    const body = (await result.json()) as {
        itemTrashList: { itemTrash: { id: number; name: string; price: number } }[];
        totalPages: number;
    };
    expect(body.totalPages).toBe(2);
    const ids = (
        await trash.database.db.query<{ id: number }>(
            'SELECT id FROM item_trash WHERE seller_id=$1 ORDER BY "createdAt" DESC,id DESC LIMIT 20',
            [trash.seed.owner],
        )
    ).rows.map((row) => row.id);
    expect(body.itemTrashList.map((entry) => entry.itemTrash.id)).toEqual(ids);
    for (const { itemTrash: row } of body.itemTrashList) {
        const link = page.locator(`a[href="/item/deleted/${row.id}"]`);
        await expect(link).toContainText(row.name);
        await expect(link).toContainText(`${row.price.toLocaleString("ja-JP")}円`);
    }
    await trash.unchanged();
});
test("E-N02 page2・name/title・0件・通常文字%の検索がDBと一致する", async ({ page, context, trash }) => {
    await trash.login(context);
    await page.goto(listURL);
    await expect(page.locator(`a[href="/item/deleted/${trash.seed.rows[20].id}"]`)).toBeVisible();
    const second = page.waitForResponse((r) => r.url().includes("/item-trash/list?page=2"));
    await page.getByRole("button", { name: "2", exact: true }).click();
    expect((await (await second).json()).itemTrashList).toHaveLength(1);
    for (const keyword of ["削除商品", "動画検索専用", "一致なし検索", "%"]) {
        await page.getByPlaceholder("検索").fill(keyword);
        const response = page.waitForResponse((r) => new URL(r.url()).searchParams.get("keyword") === keyword);
        await page.getByPlaceholder("検索").press("Enter");
        const body = (await (await response).json()) as {
            itemTrashList: { itemTrash: { id: number } }[];
            totalPages: number;
        };
        const matching = trash.seed.rows
            .slice(0, 21)
            .filter((row) => String(row.name).includes(keyword) || String(row.title).includes(keyword))
            .sort(
                (a, b) =>
                    new Date(String(b.createdAt)).getTime() - new Date(String(a.createdAt)).getTime() || b.id - a.id,
            );
        expect(body.itemTrashList.map((entry) => entry.itemTrash.id)).toEqual(matching.map((row) => row.id));
        expect(body.totalPages).toBe(matching.length ? 1 : 0);
    }
    await trash.unchanged();
});
test("E-X01 1か月より古い削除行も現APIでは返ることを観測する", async ({ page, context, trash }) => {
    await trash.login(context);
    await page.goto(listURL);
    const result = await context.request.get(`${trash.api}/item-trash/list?page=2`, {
        headers: await authHeader(context),
    });
    expect(result.status()).toBe(200);
    const body = (await result.json()) as { itemTrashList: { itemTrash: { id: number; createdAt: string } }[] };
    expect(body.itemTrashList.map((entry) => entry.itemTrash.id)).toContain(trash.seed.rows[0].id);
    expect(new Date(body.itemTrashList[0].itemTrash.createdAt).getTime()).toBeLessThan(Date.now() - 31 * 86400000);
    await trash.unchanged();
});
