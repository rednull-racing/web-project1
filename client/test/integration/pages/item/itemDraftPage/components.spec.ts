import { test, expect, openDraft } from "../../../../fixtures/item/itemDraftPage/browser";
test("B-N02 概要と説明の開閉・スクロールで集計しない", async ({ page, draft }) => {
    const requests: string[] = [];
    page.on("request", (request) => { if (/on-play|sort-add|\/video\/.*play/.test(request.url())) requests.push(request.url()); });
    await openDraft(page, draft);
    const more = page.getByRole("button", { name: "...もっと見る", exact: true }); await expect(more).toHaveCount(2);
    await more.first().click(); await expect(page.getByRole("button", { name: "閉じる", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "閉じる", exact: true }).click(); await more.nth(1).click();
    await page.getByRole("button", { name: "商品説明へスクロール" }).click();
    await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toBeInViewport(); expect(requests).toEqual([]);
});
test("B-N03 画像拡大と色カード開閉", async ({ page, draft }) => {
    await openDraft(page, draft); await page.locator(".swiper-pagination-bullet").nth(1).click();
    await page.getByRole("img", { name: "Slide 2", exact: true }).click();
    await expect(page.locator('[class*="sliderModal"] .swiper-slide-active img')).toHaveAttribute("alt", "全画面スライド 2");
    await page.getByRole("img", { name: "全画面スライド 2", exact: true }).locator("xpath=ancestor::div[contains(@class, 'overlay')]").locator(":scope > svg").click();
    await expect(page.getByRole("img", { name: "全画面スライド 2", exact: true })).toHaveCount(0);
    const card = page.locator('[class*="variantCard"]').filter({ hasText: "赤" });
    await card.click(); await expect(card).toHaveClass(/active/); await card.click(); await expect(card).not.toHaveClass(/active/);
});
test("Q05 削除開始と商品概要がキーボード操作可能", async ({ page, draft }) => {
    await openDraft(page, draft);
    const opener = page.getByRole("button", { name: "この下書き商品を削除する", exact: true }); await expect(opener).toBeVisible();
    await opener.focus(); await page.keyboard.press("Enter"); await expect(page.getByRole("button", { name: "削除する", exact: true })).toBeVisible();
    await page.keyboard.press("Escape"); const peek = page.getByRole("button", { name: "商品説明へスクロール" });
    await peek.focus(); await expect(peek).toBeFocused(); await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toBeInViewport();
});
test("Q06 削除確認dialog・focus trap・Escape・復帰", async ({ page, draft }) => {
    await openDraft(page, draft); const opener = page.getByText("この下書き商品を削除する", { exact: true }); await opener.click();
    const dialog = page.getByRole("dialog", { name: "確認" }); await expect(dialog).toBeVisible();
    for (let index = 0; index < 5; index++) { await page.keyboard.press(index % 2 === 0 ? "Tab" : "Shift+Tab"); expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy(); }
    await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
});
test("Q08 拡大画像と色カードがキーボード操作可能", async ({ page, draft }) => {
    await openDraft(page, draft);
    const imageButton = page.getByRole("button", { name: /画像.*拡大|Slide 2/ }).first(); await expect(imageButton).toBeVisible();
    await imageButton.focus(); await page.keyboard.press("Enter"); await page.getByRole("button", { name: /閉じる/ }).click();
    const variant = page.getByRole("button", { name: /赤/ }); await variant.focus(); await page.keyboard.press("Space");
    await expect(variant).toHaveAttribute("aria-expanded", "true");
});
test("B-O01 メディア読込と操作時間の記録", async ({ page, draft }, info) => {
    const failed: string[] = [];
    page.on("requestfailed", (request) => { if (["image", "media"].includes(request.resourceType())) failed.push(new URL(request.url()).pathname); });
    const started = Date.now(); await openDraft(page, draft); const image = page.getByRole("img", { name: "商品画像1枚目" });
    await expect(image).toBeVisible(); await expect.poll(() => image.evaluate((element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0)).toBeTruthy();
    expect(failed).toEqual([]); await info.attach("media-and-operation", { body: JSON.stringify({ milliseconds: Date.now() - started, failed }), contentType: "application/json" });
});
