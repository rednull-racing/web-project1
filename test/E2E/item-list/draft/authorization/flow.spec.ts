import { test, expect, openList, removeRow } from "../../../../fixtures/item-list/draft/harness.js";
test("E-S01 sessionなしはloginへ、tokenなしGETは401", async ({ page, context, baseURL, e2e, listing }) => {
    await page.goto("/item-list/draft");
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await openList(page, context, baseURL, e2e.login);
    await context.clearCookies({ name: "access-token" });
    const result = await page.evaluate(
        async (base) => {
            const r = await fetch(`${base}/item-draft/list?page=1`);
            return { status: r.status, body: await r.json() };
        },
        e2e.express.href.replace(/\/$/, ""),
    );
    expect(result.status).toBe(401);
    expect(result.body).not.toHaveProperty("itemDraftList");
    await listing.unchanged();
});
test("E-S02 tokenを消して削除するとDELETEなしでDB不変", async ({ page, context, baseURL, e2e, listing }) => {
    await openList(page, context, baseURL, e2e.login);
    const target = listing.rows[20];
    await expect(page.locator(`a[href="/item/draft/${target.id}"]`)).toBeVisible();
    await context.clearCookies({ name: "access-token" });
    const requests: string[] = [];
    page.on("request", (r) => {
        if (r.method() === "DELETE") requests.push(r.url());
    });
    await removeRow(page, target.id);
    await expect(page.getByText("下書き商品の削除に失敗しました")).toBeVisible();
    expect(requests).toEqual([]);
    await listing.unchanged();
});
for (const target of ["other", "missing"] as const)
    test(`E-S03 ${target}のIDへ要求改変しても404でDB不変`, async ({ page, context, baseURL, e2e, listing }) => {
        await openList(page, context, baseURL, e2e.login);
        const own = listing.rows[20];
        await expect(page.locator(`a[href="/item/draft/${own.id}"]`)).toBeVisible();
        // 正規ルートを維持し、認可検証のためIDだけ変更する。
        await page.route(`**/item-draft/${own.id}`, (route) =>
            route.continue({
                url: route
                    .request()
                    .url()
                    .replace(String(own.id), target === "other" ? String(e2e.seed.otherDraft.id) : "2147483647"),
            }),
        );
        const response = page.waitForResponse((r) => r.request().method() === "DELETE");
        await removeRow(page, own.id);
        const result = await response;
        expect(result.status()).toBe(404);
        expect((await result.json()).code).toBe("ITEM_DRAFT_NOT_FOUND");
        await expect(page.getByText("下書き商品を削除しました", { exact: true })).toHaveCount(0);
        await listing.unchanged();
    });
