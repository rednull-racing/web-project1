import { updateItemEditingConfirmBodySchema } from "../../../../../server/src/validators/body/itemEditing.js";
import { test, expect, authHeader } from "../../../../fixtures/item/itemConfirmPage/harness.js";
for (const mode of ["normal", "edit"] as const)
    test(`D01 D05 ${mode} 保存と公開データ不変`, async ({ page, context, baseURL, e2e }) => {
        await e2e.login(context, baseURL!);
        const editing = mode === "normal" ? e2e.seed.normal : e2e.seed.edit;
        await e2e.database.db.query("UPDATE item_editing SET attributes=$1 WHERE id=$2", [
            JSON.stringify({ inventory: { initial: 1, current: 1 }, colorVariants: [], materials: [] }),
            editing.id,
        ]);
        const before = (
            await e2e.database.db.query("SELECT * FROM item WHERE seller_id=$1 ORDER BY id", [e2e.seed.owner.id])
        ).rows;
        await page.goto(`/upload/${mode === "edit" ? "edit/" : ""}${editing.id}`);
        await expect(page.getByPlaceholder("商品名（50文字以内）")).toHaveValue("確認用シャツ");
        await page.getByPlaceholder("商品名（50文字以内）").fill("保存したシャツ");
        const pending = page.waitForResponse(
            (r) => r.request().method() === "PUT" && new URL(r.url()).pathname.endsWith(`/item-editing/${editing.id}`),
        );
        await page.getByRole("button", { name: "出品する", exact: true }).click();
        const response = await pending;
        const validation = updateItemEditingConfirmBodySchema.safeParse(response.request().postDataJSON());
        await test
            .info()
            .attach("body-contract-issues", {
                body: JSON.stringify(
                    validation.success
                        ? []
                        : validation.error.issues.map((issue) => ({
                              path: issue.path,
                              code: issue.code,
                              message: issue.message,
                          })),
                ),
                contentType: "application/json",
            });
        const payload: unknown = await response.json().catch(() => null);
        const code =
            payload && typeof payload === "object" && "code" in payload && typeof payload.code === "string"
                ? payload.code
                : null;
        await test
            .info()
            .attach("D01-response", {
                body: JSON.stringify({ status: response.status(), code }),
                contentType: "application/json",
            });
        expect(validation.success).toBe(true);
        expect(response.status()).toBe(200);
        await expect(page).toHaveURL(new RegExp(`/item/confirm/${mode === "edit" ? "edit/" : ""}${editing.id}$`));
        expect(await e2e.database.get("item_editing", editing.id)).toMatchObject({ name: "保存したシャツ" });
        expect(
            (await e2e.database.db.query("SELECT * FROM item WHERE seller_id=$1 ORDER BY id", [e2e.seed.owner.id]))
                .rows,
        ).toEqual(before);
        const headers = await authHeader(context);
        expect((await e2e.http(`/item-editing/${editing.id}/confirm`, { headers })).status).toBe(200);
        await e2e.expectProtected();
    });
