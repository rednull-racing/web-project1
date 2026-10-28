import { test, expect, openDraft } from "../../../../fixtures/item/itemDraftPage/browser";

for (const operation of ["delete", "top-bottom", "bottom-top", "edit-delete", "delete-edit"] as const) {
    const id = operation === "delete" ? "Q01" : operation.includes("bottom") ? "Q02" : "Q03";
    test(`${id} ${operation}保留中に追加の業務要求を送らない`, async ({ page, draft }) => {
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        const requests: string[] = [];
        await page.route(/\/item-editing\/draft$|\/item-draft\/\d+$/, async (route) => {
            requests.push(route.request().method());
            await gate;
            await route.fulfill({ status: 500, json: { code: "TEST_END" } });
        });
        await openDraft(page, draft);
        const edit = page.getByRole("button", { name: "編集する", exact: true });
        const remove = page.getByRole("button", { name: "削除する", exact: true });
        const openDelete = () => page.getByText("この下書き商品を削除する", { exact: true }).click();
        try {
            if (operation === "delete" || operation === "delete-edit") {
                await openDelete();
                await remove.click();
            } else await edit.nth(operation === "bottom-top" ? 1 : 0).click();
            await expect.poll(() => requests.length).toBe(1);
            if (operation === "delete") {
                if (await remove.isEnabled()) await remove.dblclick();
                await expect(remove).toBeDisabled();
            } else if (operation === "edit-delete") {
                await openDelete();
                if ((await remove.isVisible()) && (await remove.isEnabled())) await remove.click();
            } else if (operation === "delete-edit") {
                if (await edit.first().isEnabled()) await edit.first().click();
            } else {
                const other = edit.nth(operation === "bottom-top" ? 0 : 1);
                if (await other.isEnabled()) await other.click();
                await expect(other).toBeDisabled();
            }
            expect(requests).toHaveLength(1);
        } finally {
            release();
        }
    });
}

test("Q04 削除成功後の遷移待ちにも再削除できない", async ({ page, draft }) => {
    let count = 0;
    await page.clock.install();
    await page.route(/\/item-draft\/\d+$/, async (route) => {
        count++;
        await route.fulfill({ status: 200, json: { message: "下書き商品を削除しました" } });
    });
    await openDraft(page, draft);
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 50));
    const open = page.getByText("この下書き商品を削除する", { exact: true });
    await open.click();
    await page.getByRole("button", { name: "削除する", exact: true }).click();
    await expect(page.getByText("下書き商品を削除しました", { exact: true })).toBeVisible();
    if (await open.isVisible()) await open.click();
    const again = page.getByRole("button", { name: "削除する", exact: true });
    if ((await again.isVisible()) && (await again.isEnabled())) await again.click();
    expect(count).toBe(1);
});
