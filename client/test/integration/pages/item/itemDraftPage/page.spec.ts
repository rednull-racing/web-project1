import { test, expect, openDraft, apiOrigin, setBrowserSession } from "../../../../fixtures/item/itemDraftPage/browser";
import { emptyBrowserDraft } from "../../../../fixtures/item/itemDraftPage/browserData";
for (const empty of [false, true]) {
    test(`B-N01 ${empty ? "未入力" : "標準"}データのSSRとHydration`, async ({ page, draft, putDraft, request, errors }) => {
        if (empty) { Object.assign(draft, emptyBrowserDraft(), { id: draft.id }); await putDraft(draft); }
        const response = await page.request.get(`/item/draft/${draft.id}`);
        expect(response.ok()).toBeTruthy();
        expect(await response.text()).toContain(empty ? "タイトル未入力" : "動画タイトル");
        await openDraft(page, draft);
        await expect(page.getByRole("heading", { name: empty ? "タイトル未入力" : "動画タイトル", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: empty ? "商品名未入力" : "下書きシャツ", exact: true })).toBeVisible();
        await expect(page.getByText("保存日時：", { exact: true })).toBeVisible();
        await expect(page.getByText("動画がありません。", { exact: true })).toBeVisible();
        if (empty) await expect(page.getByRole("heading", { name: "￥-", exact: true })).toBeVisible();
        expect(errors).toEqual([]);
    });
    test(`B-N04 ${empty ? "未入力" : "標準"}の商品名で非公開メタデータ`, async ({ page, draft, putDraft, request }) => {
        if (empty) { draft.name = null; await putDraft(draft); }
        await openDraft(page, draft);
        const name = empty ? "商品名未入力" : "下書きシャツ";
        await expect(page).toHaveTitle(`${name} | 下書き`);
        await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", `「${name}」の下書き`);
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
        const state = await (await request.get(`${apiOrigin}/__test__/state`)).json() as { unknown: string[] };
        expect(state.unknown.filter((path) => path.includes(`/items/${draft.id}/`))).toEqual([]);
    });
}
test("B-S01 未ログインは取得前にloginへ遷移", async ({ page, context, draft, request }) => {
    await context.clearCookies(); await page.goto(`/item/draft/${draft.id}`);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toHaveCount(0);
    const state = await (await request.get(`${apiOrigin}/__test__/state`)).json() as { entries: Record<string, { requests: number }> };
    expect(state.entries[draft.id].requests).toBe(0);
});
for (const seller of [8, null]) {
    test(`B-S02 seller=${seller}は下書きを公開しない`, async ({ page, draft, putDraft }) => {
        draft.seller_id = seller; await putDraft(draft); await page.goto(`/item/draft/${draft.id}`);
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
        await expect(page).not.toHaveTitle(`${draft.name} | 下書き`);
    });
}
for (const status of [401, 404, 500]) {
    test(`B-F01 GET ${status}で操作を表示しない`, async ({ page, draft, putDraft }) => {
        await putDraft(draft, { status }); const response = await page.goto(`/item/draft/${draft.id}`);
        if (status === 401) await expect(page).toHaveURL(/\/login(?:\?|$)/);
        if (status === 404) expect(response?.status()).toBe(404);
        if (status === 500) await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    });
}
test("B-F01 GET接続断で操作を表示しない", async ({ page, draft, putDraft }) => {
    await putDraft(draft, { disconnect: true }); await page.goto(`/item/draft/${draft.id}`);
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    await expect(page.getByText("この下書き商品を削除する", { exact: true })).toHaveCount(0);
});
for (const width of [375, 767, 768, 1024]) {
    test(`B-N05 幅${width}のレイアウト`, async ({ page, draft, putDraft }) => {
        draft.name = "とても長い商品名".repeat(30); await putDraft(draft);
        await page.setViewportSize({ width, height: 900 }); await openDraft(page, draft);
        const columns = page.locator("main > section");
        const first = await columns.nth(0).boundingBox(); const second = await columns.nth(1).boundingBox();
        expect(first).not.toBeNull(); expect(second).not.toBeNull();
        if (width >= 768) { expect(Math.abs(first!.y - second!.y)).toBeLessThan(2); expect(first!.width / second!.width).toBeCloseTo(1.5, 1); }
        else expect(second!.y).toBeGreaterThan(first!.y + first!.height - 2);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
        await page.getByText("この下書き商品を削除する", { exact: true }).click();
        await expect(page.getByRole("button", { name: "削除する", exact: true })).toBeInViewport();
    });
}
test("B-S03 SSRとHydrationでHTMLを実行しない", async ({ page, draft, putDraft, request }) => {
    const text = '<img src=x onerror="window.__draftXss=true"><script>window.__draftXss=true</script>';
    draft.name = text; draft.summary = text; draft.detail = text; draft.title = text; await putDraft(draft);
    expect(await (await page.request.get(`/item/draft/${draft.id}`)).text()).toContain("&lt;img");
    await openDraft(page, draft);
    await expect(page.getByRole("heading", { name: text, exact: true }).first()).toBeVisible();
    expect(await page.evaluate(() => Reflect.get(window, "__draftXss"))).toBeUndefined();
    expect(await page.locator("main script").count()).toBe(0);
});
test("B-N06 編集後遷移と戻る・reload", async ({ page, draft, putDraft }) => {
    await page.route("**/item-editing/draft", async (route) => {
        expect(route.request().postDataJSON()).toEqual({ itemDraftId: Number(draft.id) });
        await putDraft(draft, { status: 404 }); await route.fulfill({ status: 201, json: { itemEditingId: 456 } });
    });
    await openDraft(page, draft); await page.getByRole("button", { name: "編集する", exact: true }).first().click();
    await expect(page).toHaveURL(/\/upload\/456$/); await page.goBack(); await page.reload();
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
});

test("B-S02 IDの文字列化とtrim後の所有者一致を許可", async ({ page, context, baseURL, draft }) => {
    await setBrowserSession(context, baseURL!, " 7 "); await openDraft(page, draft);
    await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toBeVisible();
});
test("B-N04 同一描画内でmetadataと本文の取得を共有", async ({ page, draft, request }) => {
    const before = await (await request.get(`${apiOrigin}/__test__/state`)).json() as { entries: Record<string, { requests: number }> };
    await openDraft(page, draft);
    const after = await (await request.get(`${apiOrigin}/__test__/state`)).json() as { entries: Record<string, { requests: number }> };
    expect(after.entries[draft.id].requests - before.entries[draft.id].requests).toBe(1);
});
