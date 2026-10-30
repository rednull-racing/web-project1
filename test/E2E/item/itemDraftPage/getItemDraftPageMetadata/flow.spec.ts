import { test, expect, openOwnedDraft } from "../../../../fixtures/item/itemDraftPage/harness.js";

for (const name of ["下書きシャツ", null, "", '<img src=x onerror="window.__metadataXss=true">']) {
    test(`AF-META01 name=${JSON.stringify(name)}の専用APIと非公開メタデータ`, async ({ page, context, baseURL, e2e }) => {
        await e2e.database.db.query("UPDATE item_draft SET name=$1 WHERE id=$2", [name, e2e.seed.draft.id]);
        const before = await e2e.database.get("item_draft", e2e.seed.draft.id);
        await openOwnedDraft(page, context, baseURL, e2e);
        const metadata = e2e.getResponses.filter((response) => response.path === `/item-draft/${e2e.seed.draft.id}/metadata`);
        expect(metadata).toEqual([{
            path: `/item-draft/${e2e.seed.draft.id}/metadata`,
            status: 200,
            body: { itemDraft: { id: e2e.seed.draft.id, name } },
        }]);
        expect(e2e.getResponses.filter((response) => response.path === `/item-draft/${e2e.seed.draft.id}/item-page`)).toHaveLength(1);
        const displayName = name || "商品名未入力";
        await expect(page).toHaveTitle(`${displayName} | 下書き`);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", `「${displayName}」の下書き`);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
        expect(await page.evaluate(() => Reflect.get(window, "__metadataXss"))).toBeUndefined();
        expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(before);
        expect(await e2e.editingRows()).toEqual([]);
        await e2e.expectProtected();
    });
}

test("AF-META02 他人の下書きは専用API404でメタデータ・操作非公開", async ({ page, context, baseURL, e2e }) => {
    await e2e.login(context, baseURL!);
    const response = await page.goto(`/item/draft/${e2e.seed.otherDraft.id}`);
    expect(response?.status()).toBe(404);
    expect(e2e.getResponses.filter((result) => result.path === `/item-draft/${e2e.seed.otherDraft.id}/metadata`)).toEqual([{
        path: `/item-draft/${e2e.seed.otherDraft.id}/metadata`, status: 404,
        body: { code: "ITEM_DRAFT_NOT_FOUND", message: "ITEM_DRAFT_NOT_FOUND" },
    }]);
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    await expect(page).not.toHaveTitle(/他人の下書き/);
    await expect(page.getByText("他人の下書き", { exact: true })).toHaveCount(0);
    await e2e.expectProtected();
});

test("AF-META03 未認証はAPI取得前にログインへ遷移", async ({ page, e2e }) => {
    await page.goto(`/item/draft/${e2e.seed.draft.id}`);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    expect(e2e.getResponses).toEqual([]);
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    await e2e.expectProtected();
});
