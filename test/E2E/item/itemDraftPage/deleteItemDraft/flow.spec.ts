import { test, expect, openOwnedDraft, authHeader } from "../../../../fixtures/item/itemDraftPage/harness.js";

for (const close of ["background", "icon"] as const) {
    test(`E-N03 削除確認を${close}で閉じてDB不変`, async ({ page, context, baseURL, e2e }) => {
        await openOwnedDraft(page, context, baseURL, e2e);
        let requests = 0;
        page.on("request", (request) => {
            if (request.method() === "DELETE") requests++;
        });
        await page.getByText("この下書き商品を削除する", { exact: true }).click();
        await expect(page.getByRole("button", { name: "削除する", exact: true })).toBeVisible();
        if (close === "background") await page.locator('[class*="overlay"]').click({ position: { x: 1, y: 1 } });
        else await page.getByRole("button", { name: "閉じる", exact: true }).click();
        await expect(page.getByRole("button", { name: "削除する", exact: true })).toHaveCount(0);
        expect(requests).toBe(0);
        expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
        expect(await e2e.editingRows()).toEqual([]);
        await e2e.expectProtected();
    });
}
test("E-N04 実削除の成功通知・遷移と対象だけの物理削除", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    await page.getByText("この下書き商品を削除する", { exact: true }).click();
    const response = page.waitForResponse((response) => response.request().method() === "DELETE");
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    const result = await response;
    expect(result.status()).toBe(200);
    expect(await result.json()).toEqual({ message: "下書き商品を削除しました" });
    await expect(page.getByText("下書き商品を削除しました", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "削除する", exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(/\/my-page$/);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toBeNull();
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});
for (const failure of ["consumed", "other", "zero", "overflow"] as const) {
    test(`${failure === "consumed" ? "E-F01" : failure === "other" ? "E-S02" : "E-S03"} 削除${failure}を拒否してDB不変`, async ({
        page,
        context,
        baseURL,
        e2e,
    }) => {
        await openOwnedDraft(page, context, baseURL, e2e);
        const headers = await authHeader(context);
        if (failure === "consumed")
            expect((await e2e.http(`/item-draft/${e2e.seed.draft.id}`, { method: "DELETE", headers })).status).toBe(
                200,
            );
        else
            await page.route(`**/item-draft/${e2e.seed.draft.id}`, (route) =>
                route.continue({
                    url: `${e2e.express.href.replace(/\/$/, "")}/item-draft/${failure === "other" ? e2e.seed.otherDraft.id : failure === "zero" ? 0 : 2147483648}`,
                }),
            );
        await page.getByText("この下書き商品を削除する", { exact: true }).click();
        const result = page.waitForResponse((response) => response.request().method() === "DELETE");
        await page.getByRole("button", { name: "削除する", exact: true }).click();
        expect((await result).status()).toBe(["zero", "overflow"].includes(failure) ? 400 : 404);
        await expect(page.getByText("下書き商品の削除に失敗しました", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "削除する", exact: true })).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`/item/draft/${e2e.seed.draft.id}$`));
        expect(await e2e.editingRows()).toEqual([]);
        await e2e.expectProtected();
        if (failure !== "consumed")
            expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    });
}
test("E-S01 tokenなしならDELETEせず削除拒否", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    await context.clearCookies({ name: "access-token" });
    let requests = 0;
    page.on("request", (request) => {
        if (request.method() === "DELETE") requests++;
    });
    await page.getByText("この下書き商品を削除する", { exact: true }).click();
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.getByText("下書き商品の削除に失敗しました", { exact: true })).toBeVisible();
    expect(requests).toBe(0);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});
test("E-F02 実削除レート21回目は429、非JSON失敗をalertで通知", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const headers = await authHeader(context);
    for (let index = 0; index < 20; index++)
        expect((await e2e.http(`/item-draft/${e2e.seed.otherDraft.id}`, { method: "DELETE", headers })).status).toBe(
            404,
        );
    await page.getByText("この下書き商品を削除する", { exact: true }).click();
    const result = page.waitForResponse((response) => response.request().method() === "DELETE");
    const alert = page.waitForEvent("dialog");
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    const response = await result;
    expect(response.status()).toBe(429);
    expect(response.headers()["content-type"]).toMatch(/^text\//);
    const dialog = await alert;
    expect(dialog.message()).toBe("システムエラーが発生しました。時間をおいて再試行してください");
    await dialog.dismiss();
    await expect(page).toHaveURL(new RegExp(`/item/draft/${e2e.seed.draft.id}$`));
    await expect(page.getByText("下書き商品を削除しました", { exact: true })).toHaveCount(0);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});
test("E-N05 削除後の再訪とリロードで操作不可", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    await page.getByText("この下書き商品を削除する", { exact: true }).click();
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page).toHaveURL(/\/my-page$/);
    await page.goBack();
    await page.reload();
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});
for (const operation of ["delete-repeat", "edit-both", "edit-delete", "delete-edit"] as const) {
    test(`E-Q01 ${operation}で実APIへの重複・相反送信を止める`, async ({ page, context, baseURL, e2e }) => {
        await openOwnedDraft(page, context, baseURL, e2e);
        const requests: string[] = [];
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        let firstUpstreamDone!: () => void;
        const firstDone = new Promise<void>((resolve) => {
            firstUpstreamDone = resolve;
        });
        let completed = 0;
        await page.route(/\/(?:item-editing\/draft|item-draft\/\d+)$/, async (route) => {
            if (!["POST", "DELETE"].includes(route.request().method())) {
                await route.continue();
                return;
            }
            requests.push(route.request().method());
            const response = await route.fetch();
            firstUpstreamDone();
            await gate;
            await route.fulfill({ response });
            completed++;
        });
        try {
            if (operation.startsWith("delete")) {
                await page.getByText("この下書き商品を削除する", { exact: true }).click();
                await page.getByRole("button", { name: "削除する", exact: true }).click();
            } else await page.getByRole("button", { name: "編集する", exact: true }).first().click();
            await firstDone;
            if (operation === "delete-repeat") {
                await page
                    .getByRole("button", { name: "削除する", exact: true })
                    .evaluate((button) => (button as HTMLButtonElement).click());
            } else if (operation === "edit-delete") {
                await page
                    .getByText("この下書き商品を削除する", { exact: true })
                    .evaluate((element) => (element as HTMLElement).click());
                const submit = page.getByRole("button", { name: "削除する", exact: true });
                if (await submit.count()) await submit.evaluate((button) => (button as HTMLButtonElement).click());
            } else
                await page
                    .getByRole("button", { name: "編集する", exact: true })
                    .last()
                    .evaluate((button) => (button as HTMLButtonElement).click());
            await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
        } finally {
            release();
        }
        await expect.poll(() => completed).toBe(requests.length);
        expect.soft(requests).toHaveLength(1);
        expect((await e2e.editingRows()).length).toBeLessThanOrEqual(1);
        expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toBeNull();
        await e2e.expectProtected();
    });
}
test("E-S01 署名不正tokenは実401で削除拒否", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const original = (await context.cookies()).find((cookie) => cookie.name === "access-token");
    expect(original).toBeDefined();
    const invalid = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: e2e.seed.owner.id, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.invalid-signature`;
    await context.addCookies([{ ...original!, value: invalid }]);
    await page.getByText("この下書き商品を削除する", { exact: true }).click();
    const result = page.waitForResponse((response) => response.request().method() === "DELETE");
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    expect((await result).status()).toBe(401);
    await expect(page.getByText("下書き商品の削除に失敗しました", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/item/draft/${e2e.seed.draft.id}$`));
    expect(await e2e.editingRows()).toEqual([]);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    await e2e.expectProtected();
});
test("E-Q01 削除成功後1500ms内に同じ対象を再送しない", async ({ page, context, baseURL, e2e }) => {
    await page.clock.install();
    await openOwnedDraft(page, context, baseURL, e2e);
    const sent: string[] = [];
    page.on("request", (request) => {
        if (request.method() === "DELETE") sent.push(new URL(request.url()).pathname);
    });
    await page.getByText("この下書き商品を削除する", { exact: true }).click();
    const result = page.waitForResponse((response) => response.request().method() === "DELETE");
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    expect((await result).status()).toBe(200);
    await expect(page.getByText("下書き商品を削除しました", { exact: true })).toBeVisible();
    await page
        .getByText("この下書き商品を削除する", { exact: true })
        .evaluate((element) => (element as HTMLElement).click());
    const submit = page.getByRole("button", { name: "削除する", exact: true });
    if (await submit.count()) await submit.evaluate((element) => (element as HTMLButtonElement).click());
    await page.clock.runFor(1499);
    expect(sent).toHaveLength(1);
    await expect(page).toHaveURL(new RegExp(`/item/draft/${e2e.seed.draft.id}$`));
    await page.clock.runFor(1);
    await expect(page).toHaveURL(/\/my-page$/);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toBeNull();
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});
