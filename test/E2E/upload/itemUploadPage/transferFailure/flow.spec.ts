import { test, expect } from "../../../../fixtures/item/itemConfirmPage/harness.js";
const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j2ioAAAAASUVORK5CYII=",
    "base64",
);
for (const target of ["video", "thumbnail", "item", "attributes"] as const) {
    test(`D04 ${target} 外部転送だけ失敗させDB残存と停止を確認`, async ({ page, context, baseURL, e2e }) => {
        await e2e.login(context, baseURL!);
        const editing = e2e.seed.normal;
        let shopId: number | undefined;
        const attributes =
            target === "attributes"
                ? {
                      inventory: { initial: 2, current: 2 },
                      colorVariants: [
                          {
                              uiId: "red",
                              color: "赤",
                              inventory: { initial: 2, current: 2 },
                              sizes: [{ size: "M", inventory: { initial: 2, current: 2 } }],
                          },
                      ],
                      materials: [],
                  }
                : { inventory: { initial: 1, current: 1 }, colorVariants: [], materials: [] };
        try {
            if (target === "attributes") {
                const inserted = await e2e.database.db.query<{
                    id: number;
                }>(
                    'INSERT INTO shop_info(user_id,verified,"createdAt","updatedAt") VALUES($1,true,NOW(),NOW()) RETURNING id',
                    [e2e.seed.owner.id],
                );
                shopId = inserted.rows[0].id;
            }
            await e2e.database.db.query("UPDATE item_editing SET attributes=$1 WHERE id=$2", [
                JSON.stringify(attributes),
                editing.id,
            ]);
            const external: string[] = [];
            await page.route("**/*", async (route) => {
                const request = route.request();
                const url = new URL(request.url());
                if (["POST", "PUT"].includes(request.method()) && /amazonaws\.com$/.test(url.hostname)) {
                    external.push(request.method());
                    await route.fulfill({ status: 500, body: "isolated external upload failure" });
                } else await route.fallback();
            });
            await page.goto(`/upload/${editing.id}`);
            const placeholder = {
                video: "動画ファイルをアップロード",
                thumbnail: "画像ファイルをアップロード",
                item: "商品画像をアップロード",
                attributes: "画像をアップロード",
            }[target];
            await page.getByPlaceholder(placeholder, { exact: true }).setInputFiles({
                name: target === "video" ? "failure.mp4" : `${target}.png`,
                mimeType: target === "video" ? "video/mp4" : "image/png",
                buffer: target === "video" ? Buffer.from("isolated-upload-failure") : png,
            });
            const pending = page.waitForResponse(
                (response) =>
                    response.request().method() === "PUT" &&
                    new URL(response.url()).pathname.endsWith(`/item-editing/${editing.id}`),
            );
            await page.getByRole("button", { name: "出品する", exact: true }).click();
            const saved = await pending;
            await test.info().attach("D04-save-status", {
                body: JSON.stringify({ status: saved.status() }),
                contentType: "application/json",
            });
            expect(saved.status(), "業務保存APIが成功した後で外部失敗を検証する").toBe(200);
            await expect.poll(() => external.length).toBeGreaterThan(0);
            await expect(page.getByText(/アップロードに失敗しました/)).toBeVisible();
            await expect(page.getByRole("button", { name: "出品する", exact: true })).toBeEnabled();
            expect(new URL(page.url()).pathname).toBe(`/upload/${editing.id}`);
            expect(await e2e.database.get("item_editing", editing.id)).not.toBeNull();
            await e2e.expectProtected();
        } finally {
            if (shopId !== undefined)
                await e2e.database.db.query("DELETE FROM shop_info WHERE id=$1 AND user_id=$2", [
                    shopId,
                    e2e.seed.owner.id,
                ]);
        }
    });
}
