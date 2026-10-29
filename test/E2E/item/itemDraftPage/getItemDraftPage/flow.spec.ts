import { test, expect, openOwnedDraft } from "../../../../fixtures/item/itemDraftPage/harness.js";

test("AF-GET01 実GETの公開契約とSSR表示・DB不変", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const responses = e2e.getResponses.filter((response) => response.path === `/item-draft/${e2e.seed.draft.id}/item-page`);
    expect(responses).toHaveLength(1);
    expect(responses[0].status).toBe(200);
    const draft = responses[0].body.itemDraft as Record<string, unknown>;
    expect(draft.id).toBe(e2e.seed.draft.id);
    expect(draft.seller_id).toBe(e2e.seed.owner.id);
    expect(draft.updatedAt).toBe(new Date(String(e2e.seed.draft.updatedAt)).toISOString());
    expect(draft.Category).toMatchObject({ parent: null, children: [] });
    expect(draft.ItemConditionOption).toMatchObject({ name: "新品" });
    for (const key of ["createdAt", "video_status", "category_id", "brand_aliases_id"]) expect(draft).not.toHaveProperty(key);
    await expect(page.getByText("下書きシャツ", { exact: true }).first()).toBeVisible();
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});

test("AF-GET02 他人の下書きは実GET404でSSRに操作と商品名を出さない", async ({ page, context, baseURL, e2e }) => {
    await e2e.login(context, baseURL!);
    await page.goto(`/item/draft/${e2e.seed.otherDraft.id}`);
    expect(e2e.getResponses.filter((response) => response.path === `/item-draft/${e2e.seed.otherDraft.id}/item-page`).map((response) => response.status)).toEqual([404]);
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(0);
    await expect(page.getByText("他人の下書き", { exact: true })).toHaveCount(0);
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});

test("AF-GET03 E-N02 未入力値を実GETからSSRへ渡す", async ({ page, context, baseURL, e2e }) => {
    await openOwnedDraft(page, context, baseURL, e2e);
    const response = e2e.getResponses.find((response) => response.path === `/item-draft/${e2e.seed.draft.id}/item-page`);
    expect(response?.status).toBe(200);
    expect(response?.body.itemDraft).toMatchObject({ id: e2e.seed.draft.id, name: null, price: null, image_url: null, title: null, attributes: {} });
    expect(await e2e.database.get("item_draft", e2e.seed.draft.id)).toEqual(e2e.seed.draft);
    expect(await e2e.editingRows()).toEqual([]);
    await e2e.expectProtected();
});
