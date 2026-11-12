import { test as base, expect, authHeader } from "./backendHarness.js";
import type { BrowserContext, Page } from "@playwright/test";
import type { Row } from "../../item/itemDraftPage/database.js";
export const test = base.extend<{
    listing: { rows: Row[]; unowned: Row; unchanged: () => Promise<void>; protected: () => Promise<void> };
}>({
    listing: async ({ e2e }, provide) => {
        const rows = [e2e.seed.draft, e2e.seed.sameOwnerDraft];
        const { id, ...template } = e2e.seed.draft;
        void id;
        for (let i = 2; i < 21; i++)
            rows.push(
                await e2e.database.insert("item_draft", {
                    ...template,
                    name: i === 2 ? "検索%通常" : i === 3 ? "検索_通常" : `一覧商品${i}`,
                    title: i === 4 ? "動画検索専用" : `動画${i}`,
                }),
            );
        const unowned = await e2e.database.insert("item_draft", { ...template, seller_id: null, name: "所有者なし" });
        const items = await e2e.database.db.query<Row>(
            "SELECT * FROM item WHERE seller_id=ANY($1::int[]) ORDER BY id",
            [e2e.seed.owners],
        );
        const protectedRows = async () => {
            await e2e.expectProtected();
            expect(await e2e.database.get("item_draft", unowned.id)).toEqual(unowned);
            expect(
                (
                    await e2e.database.db.query<Row>("SELECT * FROM item WHERE seller_id=ANY($1::int[]) ORDER BY id", [
                        e2e.seed.owners,
                    ])
                ).rows,
            ).toEqual(items.rows);
        };
        const unchanged = async () => {
            for (const row of rows) expect(await e2e.database.get("item_draft", row.id)).toEqual(row);
            expect(await e2e.database.get("item_draft", unowned.id)).toEqual(unowned);
            await protectedRows();
        };
        await provide({ rows, unowned, unchanged, protected: protectedRows });
    },
});
export { expect, authHeader };
export const openList = async (
    page: Page,
    context: BrowserContext,
    baseURL: string | undefined,
    login: (context: BrowserContext, url: string) => Promise<void>,
) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL missing");
    await login(context, baseURL);
    const response = page.waitForResponse((r) => new URL(r.url()).pathname.endsWith("/item-draft/list"));
    await page.goto("/item-list/draft");
    return response;
};
export const removeRow = async (page: Page, id: number) => {
    const row = page
        .locator("section")
        .filter({ has: page.locator(`a[href="/item/draft/${id}"]`) })
        .last();
    await row.locator('svg[data-icon="ellipsis-vertical"]').click();
    await row.getByText("下書きから削除", { exact: true }).click();
};
