import { test, expect, openList, removeRow, authHeader } from "../../../../fixtures/item-list/draft/harness.js";
test("E-D01 一覧から正規DELETEで対象だけ削除する", async ({ page, context, baseURL, e2e, listing }) => {
    await openList(page, context, baseURL, e2e.login);
    const target = listing.rows[20];
    await expect(page.locator(`a[href="/item/draft/${target.id}"]`)).toBeVisible();
    const response = page.waitForResponse((r) => r.request().method() === "DELETE");
    await removeRow(page, target.id);
    const result = await response;
    expect(new URL(result.url()).pathname).toBe(`/api/item-draft/${target.id}`);
    expect(result.status()).toBe(200);
    await expect(page.locator(`a[href="/item/draft/${target.id}"]`)).toHaveCount(0);
    expect(await e2e.database.get("item_draft", target.id)).toBeNull();
    for (const row of listing.rows.filter((row) => row.id !== target.id))
        expect(await e2e.database.get("item_draft", row.id)).toEqual(row);
    await listing.protected();
    expect(await e2e.database.get("item_draft", listing.unowned.id)).toEqual(listing.unowned);
});
test("E-D02 別要求で削除済みの下書きは404で収束する", async ({ page, context, baseURL, e2e, listing }) => {
    await openList(page, context, baseURL, e2e.login);
    const target = listing.rows[20];
    await expect(page.locator(`a[href="/item/draft/${target.id}"]`)).toBeVisible();
    expect(
        (await e2e.http(`/item-draft/${target.id}`, { method: "DELETE", headers: await authHeader(context) })).status,
    ).toBe(200);
    const response = page.waitForResponse((r) => r.request().method() === "DELETE");
    await removeRow(page, target.id);
    expect((await response).status()).toBe(404);
    await expect(page.locator(`a[href="/item/draft/${target.id}"]`)).toHaveCount(0);
    await expect(page.getByText("下書き商品を削除しました", { exact: true })).toHaveCount(0);
    await listing.protected();
});
