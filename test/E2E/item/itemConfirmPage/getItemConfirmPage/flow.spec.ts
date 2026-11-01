import { test, expect, openConfirm, snapshot } from "../../../../fixtures/item/itemConfirmPage/harness.js";

for (const mode of ["normal", "edit"] as const) {
    for (const name of ["確認用シャツ", null, "", '<img src=x onerror="window.__confirmXss=true">']) {
        test(`E-N03 ${mode} name=${JSON.stringify(name)} 専用取得・metadataとDB不変`, async ({
            page,
            context,
            baseURL,
            e2e,
        }) => {
            const editing = mode === "normal" ? e2e.seed.normal : e2e.seed.edit;
            await e2e.database.db.query("UPDATE item_editing SET name=$1 WHERE id=$2", [name, editing.id]);
            const before = await snapshot(e2e);
            await openConfirm(page, context, baseURL, e2e, mode);
            expect(e2e.getResponses.filter((r) => r.path === `/item-editing/${editing.id}/metadata`)).toEqual([
                {
                    path: `/item-editing/${editing.id}/metadata`,
                    status: 200,
                    body: { itemEditing: { id: editing.id, name } },
                },
            ]);
            const body = e2e.getResponses.filter((r) => r.path === `/item-editing/${editing.id}/confirm`);
            expect(body).toHaveLength(1);
            expect(body[0].status).toBe(200);
            expect(body[0].body).toMatchObject({ itemEditing: { id: editing.id, seller_id: e2e.seed.owner.id, name } });
            const display = name || "商品名未入力";
            await expect(page).toHaveTitle(
                `${display} | ${mode === "normal" ? "出品する商品の確認" : "更新する商品の確認"}`,
            );
            await expect(page.locator('meta[name="description"]')).toHaveAttribute(
                "content",
                `「${display}」の${mode === "normal" ? "アップロード確認" : "更新内容確認"}`,
            );
            await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
            expect(await page.evaluate(() => Reflect.get(window, "__confirmXss"))).toBeUndefined();
            await page.getByRole("button", { name: "出品する", exact: true }).click();
            await expect(page.getByRole("checkbox")).not.toBeChecked();
            expect(await snapshot(e2e)).toEqual(before);
            await e2e.expectProtected();
        });
    }
    for (const actor of ["unauthenticated", "other", "missing"] as const) {
        test(`E-E01 ${mode} ${actor} は非公開でDB不変`, async ({ page, context, baseURL, e2e }) => {
            const before = await snapshot(e2e);
            if (actor !== "unauthenticated") await e2e.login(context, baseURL!);
            // Logged-in owner requests B's resource: equivalent ownership rejection without changing auth fixtures.
            const id =
                actor === "other" ? e2e.seed.otherEditing.id : actor === "missing" ? 2147483647 : e2e.seed.normal.id;
            const response = await page.goto(`/item/confirm/${mode === "edit" ? "edit/" : ""}${id}`);
            if (actor === "unauthenticated") {
                await expect(page).toHaveURL(/\/login(?:\?|$)/);
                expect(e2e.getResponses).toEqual([]);
            } else {
                expect(response?.status()).toBe(404);
                expect(e2e.getResponses.filter((r) => r.path.includes(`/${id}/`)).every((r) => r.status === 404)).toBe(
                    true,
                );
                await expect(page).not.toHaveTitle(/他人の編集/);
                await expect(page.getByText("他人の編集", { exact: true })).toHaveCount(0);
            }
            await expect(page.getByRole("button", { name: "出品する", exact: true })).toHaveCount(0);
            expect(await snapshot(e2e)).toEqual(before);
            await e2e.expectProtected();
        });
    }
}
