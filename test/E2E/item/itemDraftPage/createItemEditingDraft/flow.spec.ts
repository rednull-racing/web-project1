import { test, expect, openOwnedDraft, authHeader } from "../../../../fixtures/item/itemDraftPage/harness.js";
import { copyColumns } from "../../../../fixtures/item/itemDraftPage/database.js";

for (const index of [0, 1]) {
    test(`E-N01 ${index === 0 ? "上" : "下"}編集から実APIとDBへ引き継ぐ`, async ({ page, context, baseURL, e2e }) => {
        await openOwnedDraft(page, context, baseURL, e2e);
        const responsePromise = page.waitForResponse(
            (response) =>
                response.request().method() === "POST" &&
                new URL(response.url()).pathname.endsWith("/item-editing/draft"),
        );
        await page.getByRole("button", { name: "編集する", exact: true }).nth(index).click();
        const response = await responsePromise;
        expect(response.status()).toBe(201);
        expect(response.request().postDataJSON()).toEqual({ itemDraftId: e2e.seed.draft.id });
        const { itemEditingId } = (await response.json()) as { itemEditingId: number };
        await expect(page).toHaveURL(new RegExp(`/upload/${itemEditingId}$`));
        expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toBeNull();
        const rows = await e2e.editingRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].id).toBe(itemEditingId);
        for (const column of copyColumns) expect(rows[0][column], column).toEqual(e2e.seed.draft[column]);
        expect(rows[0].seller_id).toBe(e2e.seed.owner.id);
        expect(rows[0].status).toBe("normal");
        expect(rows[0].item_id).toBeNull();
        expect(rows[0].createdAt).not.toEqual(e2e.seed.draft.createdAt);
        expect(rows[0].updatedAt).not.toEqual(e2e.seed.draft.updatedAt);
        await e2e.expectProtected();
    });
}
test("E-N02 未入力データを表示用補完に変換せず編集へ保存", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const result = page.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().endsWith("/item-editing/draft"),
    );
    await page.getByRole("button", { name: "編集する", exact: true }).first().click();
    expect((await result).status()).toBe(201);
    const rows = await e2e.editingRows();
    expect(rows).toHaveLength(1);
    for (const column of copyColumns) expect(rows[0][column], column).toEqual(e2e.seed.draft[column]);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toBeNull();
    await e2e.expectProtected();
});
for (const failure of ["consumed", "other", "invalid"] as const) {
    test(`${failure === "consumed" ? "E-F01" : failure === "other" ? "E-S02" : "E-S03"} 編集拒否とDB不変`, async ({
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
        if (failure !== "consumed")
            await page.route("**/item-editing/draft", (route) =>
                route.continue({
                    postData: JSON.stringify({ itemDraftId: failure === "other" ? e2e.seed.otherDraft.id : 0 }),
                }),
            );
        const result = page.waitForResponse(
            (response) => response.request().method() === "POST" && response.url().endsWith("/item-editing/draft"),
        );
        await page.getByRole("button", { name: "編集する", exact: true }).first().click();
        expect((await result).status()).toBe(failure === "invalid" ? 400 : 404);
        await expect(
            page.getByText("下書きの編集を開始できませんでした。時間を置いて再試行してください", { exact: true }),
        ).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`/item/draft/${e2e.seed.draft.id}$`));
        expect(await e2e.editingRows()).toEqual([]);
        await e2e.expectProtected();
        if (failure !== "consumed")
            expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    });
}
test("E-S01 tokenなしなら業務HTTPを送らず編集を拒否", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    await context.clearCookies({ name: "access-token" });
    let requests = 0;
    page.on("request", (request) => {
        if (request.method() === "POST" && request.url().endsWith("/item-editing/draft")) requests++;
    });
    await page.getByRole("button", { name: "編集する", exact: true }).first().click();
    await expect(
        page.getByText("下書きの編集を開始できませんでした。時間を置いて再試行してください", { exact: true }),
    ).toBeVisible();
    expect(requests).toBe(0);
    expect(await e2e.editingRows()).toEqual([]);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    await e2e.expectProtected();
});
test("E-F02 実編集レート6回目は429でDB不変", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const headers = await authHeader(context);
    for (let index = 0; index < 5; index++)
        expect(
            (
                await e2e.http("/item-editing/draft", {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ itemDraftId: e2e.seed.otherDraft.id }),
                })
            ).status,
        ).toBe(404);
    const result = page.waitForResponse((response) => response.url().endsWith("/item-editing/draft"));
    await page.getByRole("button", { name: "編集する", exact: true }).first().click();
    expect((await result).status()).toBe(429);
    await expect(
        page.getByText("下書きの編集を開始できませんでした。時間を置いて再試行してください", { exact: true }),
    ).toBeVisible();
    expect(await e2e.editingRows()).toEqual([]);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    await e2e.expectProtected();
});
test("E-N05 編集消費後の再訪とリロードで古い操作を出さない", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    await page.getByRole("button", { name: "編集する", exact: true }).first().click();
    await expect(page).toHaveURL(/\/upload\/\d+$/);
    await page.goBack();
    await page.reload();
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    expect(await e2e.editingRows()).toHaveLength(1);
    await e2e.expectProtected();
});
test("E-S01 署名不正tokenは実401で編集拒否", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const original = (await context.cookies()).find((cookie) => cookie.name === "access-token");
    expect(original).toBeDefined();
    const invalid = `${Buffer.from('{"alg":"HS256"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: e2e.seed.owner.id, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.invalid-signature`;
    await context.addCookies([{ ...original!, value: invalid }]);
    const result = page.waitForResponse(
        (response) => response.request().method() === "POST" && response.url().endsWith("/item-editing/draft"),
    );
    await page.getByRole("button", { name: "編集する", exact: true }).first().click();
    expect((await result).status()).toBe(401);
    await expect(
        page.getByText("下書きの編集を開始できませんでした。時間を置いて再試行してください", { exact: true }),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/item/draft/${e2e.seed.draft.id}$`));
    expect(await e2e.editingRows()).toEqual([]);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    await e2e.expectProtected();
});
