import { test, expect, authHeader } from "../../../../fixtures/item-list/uploaded/harness.js";

type Body = {
    itemList: { item: { id: number; name: string; status: string; Video: null; Sale: null } }[];
    totalPages: number;
};

test("E-N01 本人21件の順序・20件ページングと実画面のwire接続", async ({ page, context, baseURL, e2e, uploaded }) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL required");
    await e2e.login(context, baseURL);
    const response = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/items/list/uploaded"));
    await page.goto("/item-list/uploaded");
    const result = await response;
    expect(result.status()).toBe(200);
    const body = (await result.json()) as Body;
    const expected = uploaded.rows.slice(0, 21).reverse();
    expect(body.totalPages).toBe(2);
    expect(body.itemList.map(({ item }) => item.id)).toEqual(expected.slice(0, 20).map((row) => row.id));
    for (const { item } of body.itemList) {
        expect(item.Video).toBeNull();
        expect(item.Sale).toBeNull();
        expect(item).not.toHaveProperty("seller_id");
        expect(item).not.toHaveProperty("search_text");
        await expect(page.locator(`a[href="/item/${item.id}"]`)).toContainText(item.name);
    }
    const second = page.waitForResponse((r) => new URL(r.url()).searchParams.get("page") === "2");
    await page.getByRole("button", { name: "2", exact: true }).click();
    expect(((await (await second).json()) as Body).itemList.map(({ item }) => item.id)).toEqual([expected[20].id]);
    await uploaded.unchanged();
});

test("E-N02 selling/soldタブの実status接続と検索・0件・所有権偽装", async ({
    page,
    context,
    baseURL,
    e2e,
    uploaded,
}) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL required");
    await e2e.login(context, baseURL);
    for (const [tab, status] of [
        ["selling", "active"],
        ["sold", "soldout"],
    ]) {
        const response = page.waitForResponse((r) => new URL(r.url()).searchParams.get("status") === status);
        await page.goto(`/item-list/uploaded?tab=${tab}`);
        const body = (await (await response).json()) as Body;
        expect(body.itemList.map(({ item }) => item.id)).toEqual(
            uploaded.rows
                .slice(0, 21)
                .filter((row) => row.status === status)
                .reverse()
                .map((row) => row.id),
        );
    }
    for (const [keyword, ids] of [
        ["%", [uploaded.rows[0].id]],
        ["一致なし", []],
    ] as const) {
        const response = await context.request.get(
            `${e2e.express.href.replace(/\/$/, "")}/items/list/uploaded?page=1&keyword=${encodeURIComponent(keyword)}&seller_id=${e2e.seed.other.id}`,
            { headers: await authHeader(context) },
        );
        expect(response.status()).toBe(200);
        expect(((await response.json()) as Body).itemList.map(({ item }) => item.id)).toEqual(ids);
    }
    await uploaded.unchanged();
});

test("E-A01 未認証APIは拒否しDBを変更しない", async ({ e2e, uploaded }) => {
    const response = await e2e.http("/items/list/uploaded?page=1");
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("出品商品");
    await uploaded.unchanged();
});
