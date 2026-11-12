import { test, expect, openList } from "../../../../fixtures/item-list/draft/harness.js";
test("E-N01 本人21件を20件ずつ実JSONと画面へ接続する", async ({ page, context, baseURL, e2e, listing }) => {
    const result = await openList(page, context, baseURL, e2e.login);
    expect(result.status()).toBe(200);
    const body = await result.json();
    const expected = await e2e.database.db.query<{ id: number }>(
        'SELECT id FROM item_draft WHERE seller_id=$1 ORDER BY "createdAt" DESC,id DESC LIMIT 20',
        [e2e.seed.owner.id],
    );
    expect(body.totalPages).toBe(2);
    expect(body.itemDraftList.map((entry: { itemDraft: { id: number } }) => entry.itemDraft.id)).toEqual(
        expected.rows.map((row) => row.id),
    );
    for (const entry of body.itemDraftList)
        await expect(page.locator(`a[href="/item/draft/${entry.itemDraft.id}"]`)).toContainText(entry.itemDraft.name);
    await listing.unchanged();
});
test("E-N02 ページ2とname・title・0件・特殊文字検索の契約", async ({ page, context, baseURL, e2e, listing }) => {
    await openList(page, context, baseURL, e2e.login);
    await expect(page.locator(`a[href="/item/draft/${listing.rows[20].id}"]`)).toBeVisible();
    const response = page.waitForResponse((r) => r.url().includes("/item-draft/list?page=2"));
    await page.getByRole("button", { name: "2", exact: true }).click();
    expect((await (await response).json()).itemDraftList).toHaveLength(1);
    for (const keyword of ["一覧商品", "動画検索専用", "存在しない検索語", "%", "_"]) {
        await page.getByPlaceholder("検索").fill(keyword);
        const result = page.waitForResponse((r) => new URL(r.url()).searchParams.get("keyword") === keyword);
        await page.getByPlaceholder("検索").press("Enter");
        const body = await (await result).json();
        const expected = listing.rows.filter(
            (row) => String(row.name).includes(keyword) || String(row.title).includes(keyword),
        );
        expect(body.itemDraftList).toHaveLength(expected.length);
        expect(body.totalPages).toBe(expected.length ? 1 : 0);
    }
    await listing.unchanged();
});
