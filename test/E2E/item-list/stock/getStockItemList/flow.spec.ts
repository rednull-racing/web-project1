import { test, expect, authHeader } from "../../../../fixtures/item-list/stock/harness.js";

type Stock = {
    id: number;
    name: string;
    status: string;
    Video: null;
    Sale: null;
    attributes: { inventory?: { current: number } };
};
type Body = { itemList: { item: Stock }[]; totalPages: number };

test("E-N01 本人21件の20+1ページ・順序・在庫wireと実画面を接続", async ({ page, context, baseURL, e2e, stock }) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL required");
    await e2e.login(context, baseURL);
    const response = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/items/list/stock"));
    await page.goto("/item-list/stock");
    const result = await response;
    expect(result.status()).toBe(200);
    const body = (await result.json()) as Body;
    const expected = stock.rows.slice(0, 21).reverse();
    expect(body.totalPages).toBe(2);
    expect(body.itemList.map(({ item }) => item.id)).toEqual(expected.slice(0, 20).map((row) => row.id));
    await expect(page.getByRole("heading", { name: "在庫一覧", exact: true })).toBeVisible();
    for (const { item } of body.itemList) {
        expect(item.Video).toBeNull();
        expect(item.Sale).toBeNull();
        expect(item).not.toHaveProperty("seller_id");
        expect(item).not.toHaveProperty("search_text");
        const link = page.locator(`a[href="/item/${item.id}"]`);
        await expect(link).toContainText(item.name);
        const expectedCurrent = item.id === stock.rows[1].id ? 0 : 1234;
        expect(item.attributes.inventory?.current).toBe(expectedCurrent);
        await expect(link.getByText(expectedCurrent.toLocaleString("ja-JP"), { exact: true })).toBeVisible();
        await expect(link).not.toContainText("SOLD");
    }
    const second = page.waitForResponse((r) => new URL(r.url()).searchParams.get("page") === "2");
    await page.getByRole("button", { name: "2", exact: true }).click();
    const page2 = await second;
    expect(page2.status()).toBe(200);
    const tail = (await page2.json()) as Body;
    expect(tail.itemList.map(({ item }) => item.id)).toEqual([expected[20].id]);
    expect(tail.itemList[0].item.attributes).toEqual({});
    await expect(page.locator(`a[href="/item/${expected[20].id}"]`)).toContainText("在庫数：");
    await stock.unchanged();
});

test("E-N02 記号検索・0件とseller_id偽装でも本人制約を維持", async ({ page, context, baseURL, e2e, stock }) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL required");
    await e2e.login(context, baseURL);
    const initial = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/items/list/stock"));
    await page.goto("/item-list/stock");
    expect((await initial).status()).toBe(200);
    for (const [keyword, ids] of [
        ["%", [stock.rows[0].id]],
        ["一致なし", []],
    ] as const) {
        await page.getByPlaceholder("検索").fill(keyword);
        const pending = page.waitForResponse((r) => new URL(r.url()).searchParams.get("keyword") === keyword);
        await page.getByPlaceholder("検索").press("Enter");
        const response = await pending;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as Body;
        expect(body.itemList.map(({ item }) => item.id)).toEqual(ids);
        expect(body.totalPages).toBe(ids.length ? 1 : 0);
        if (!ids.length) await expect(page.getByText("商品が見つかりません")).toBeVisible();
        const spoof = await context.request.get(
            `${e2e.express.href.replace(/\/$/, "")}/items/list/stock?page=1&keyword=${encodeURIComponent(keyword)}&seller_id=${e2e.seed.other.id}`,
            { headers: await authHeader(context) },
        );
        expect(spoof.status()).toBe(200);
        expect(((await spoof.json()) as Body).itemList.map(({ item }) => item.id)).toEqual(ids);
    }
    await stock.unchanged();
});

test("E-A01 未認証401・商品情報非公開・DB不変", async ({ e2e, stock }) => {
    const response = await e2e.http("/items/list/stock?page=1");
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain("在庫商品");
    await stock.unchanged();
});
