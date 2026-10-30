import { test, expect, apiOrigin, confirmPath, openConfirm, openPopup, popup, setBrowserSession } from "../../../../fixtures/item/itemConfirmPage/browser";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const forbiddenRequests = (page: Page) => {
    const requests: string[] = [];
    page.on("request", (request) => {
        if (/\/video\/[^/]+\/onplay|\/items\/[^/]+\/sort-number\/add/.test(request.url())) requests.push(request.url());
    });
    return requests;
};

for (const mode of ["normal", "edit"] as const) {
    for (const metadataName of ["確認用シャツ", null, ""]) {
        test(`B-N01 ${mode} metadata名=${JSON.stringify(metadataName)} SSR・head・専用GET`, async ({ page, editing, putEditing, request, errors }) => {
            editing.status = mode;
            await putEditing(editing, { metadataName });
            const response = await page.request.get(confirmPath(editing, mode));
            expect(response.ok()).toBeTruthy();
            expect(await response.text()).toContain(editing.name);
            const before = await (await request.get(`${apiOrigin}/__test__/state`)).json();
            await openConfirm(page, editing, mode);
            const name = metadataName || "商品名未入力";
            await expect(page).toHaveTitle(`${name} | ${mode === "normal" ? "出品する商品の確認" : "更新する商品の確認"}`);
            await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", `「${name}」の${mode === "normal" ? "アップロード確認" : "更新内容確認"}`);
            await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex.*nofollow/);
            await expect(page.getByText(mode === "normal" ? "出品する商品の確認" : "更新する商品情報の確認", { exact: true })).toBeVisible();
            const after = await (await request.get(`${apiOrigin}/__test__/state`)).json();
            expect(after.entries[editing.id].requests - before.entries[editing.id].requests).toBe(1);
            expect(after.entries[editing.id].metadataRequests - before.entries[editing.id].metadataRequests).toBe(1);
            expect(errors).toEqual([]);
        });
    }
    test(`B-N02 ${mode} 画像・説明開閉・スクロール・戻る・reload`, async ({ page, editing, errors }) => {
        const requests = forbiddenRequests(page);
        await openConfirm(page, editing, mode);
        const more = page.getByRole("button", { name: "...もっと見る", exact: true });
        await expect(more).toHaveCount(2);
        await more.first().click();
        await page.getByRole("button", { name: "閉じる", exact: true }).click();
        await more.nth(1).click();
        await page.getByRole("button", { name: "商品説明へスクロール" }).click();
        await expect(page.getByRole("heading", { name: editing.name, exact: true })).toBeInViewport();
        await page.locator(".swiper-pagination-bullet").nth(1).click();
        await page.getByRole("button", { name: "画像2を拡大", exact: true }).click();
        await expect(page.locator('[class*="sliderModal"] .swiper-slide-active img')).toHaveAttribute("alt", "全画面スライド 2");
        await page.getByRole("button", { name: "拡大画像を閉じる", exact: true }).click();
        const variant = page.getByRole("button", { name: "赤", exact: true });
        await variant.click();
        await expect(variant).toHaveAttribute("aria-expanded", "true");
        await page.goto("/login");
        await page.goBack();
        await expect(page.getByRole("heading", { name: editing.name, exact: true })).toBeVisible();
        await page.reload();
        await expect(page.getByRole("heading", { name: editing.name, exact: true })).toBeVisible();
        expect(requests).toEqual([]);
        expect(errors).toEqual([]);
    });
    test(`B-N02 ${mode} 元動画を実再生して集計しない`, async ({ page, editing, putEditing, baseURL }) => {
        const body = await readFile(new URL("../../../../fixtures/item/itemConfirmPage/browserVideo.mp4", import.meta.url));
        editing.original_url = new URL("/__test__/confirm-video.mp4", baseURL).href;
        await page.route("**/__test__/confirm-video.mp4", (route) => route.fulfill({ status: 200, body, contentType: "video/mp4" }));
        await putEditing(editing);
        const requests = forbiddenRequests(page);
        await openConfirm(page, editing, mode);
        const video = page.locator("video");
        await expect(video).toHaveAttribute("src", editing.original_url);
        await video.evaluate(async (element) => {
            if (!(element instanceof HTMLVideoElement)) throw new Error("video element required");
            element.muted = true;
            await element.play();
        });
        await expect.poll(() => video.evaluate((element) => element instanceof HTMLVideoElement ? element.currentTime : 0)).toBeGreaterThan(0);
        expect(requests).toEqual([]);
    });
    for (const width of [375, 767, 768, 1280]) {
        test(`B-N03 ${mode} 幅${width}で2カラム境界とポップアップ操作`, async ({ page, editing }) => {
            await page.setViewportSize({ width, height: 900 });
            await openConfirm(page, editing, mode);
            const columns = page.locator("main > section");
            const first = await columns.nth(0).boundingBox();
            const second = await columns.nth(1).boundingBox();
            expect(first).not.toBeNull();
            expect(second).not.toBeNull();
            if (width >= 768) {
                expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
                expect(first!.width / second!.width).toBeCloseTo(1.5, 1);
            } else expect(second!.y).toBeGreaterThanOrEqual(first!.y + first!.height - 2);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
            await openPopup(page);
            const terms = popup(page).locator('[class*="termsDiv"]');
            await expect(terms).toHaveCount(2);
            for (const term of await terms.all()) {
                expect(await term.evaluate((element) => element.scrollHeight > element.clientHeight)).toBeTruthy();
                await term.evaluate((element) => { element.scrollTop = element.scrollHeight; });
            }
            await popup(page).getByRole("checkbox").check();
            await expect(popup(page).getByRole("button", { name: "出品する", exact: true })).toBeInViewport();
        });
    }
    test(`B-E01 ${mode} 未認証で取得前login`, async ({ page, context, editing, request }) => {
        await context.clearCookies();
        await page.goto(confirmPath(editing, mode));
        await expect(page).toHaveURL(/\/login(?:\?|$)/);
        await expect(page.getByRole("heading", { name: editing.name, exact: true })).toHaveCount(0);
        const state = await (await request.get(`${apiOrigin}/__test__/state`)).json();
        expect(state.entries[editing.id].requests).toBe(0);
        expect(state.entries[editing.id].metadataRequests).toBe(0);
    });
    test(`B-E01 ${mode} 認証更新失敗で取得前login`, async ({ page, context, baseURL, editing, request }) => {
        await setBrowserSession(context, baseURL!, "7", true);
        await page.goto(confirmPath(editing, mode));
        await expect(page).toHaveURL(/\/login(?:\?|$)/);
        const state = await (await request.get(`${apiOrigin}/__test__/state`)).json();
        expect(state.entries[editing.id].requests).toBe(0);
        expect(state.entries[editing.id].metadataRequests).toBe(0);
    });
    test(`B-E02 ${mode} 所有者不一致の防御分岐`, async ({ page, editing, putEditing }) => {
        editing.seller_id = 8;
        await putEditing(editing, { allowForeign: true });
        await page.goto(confirmPath(editing, mode));
        await expect(page).toHaveURL(/\/$/);
        await expect(page.getByRole("heading", { name: editing.name, exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "出品する", exact: true })).toHaveCount(0);
    });
    for (const status of [401, 404, 500]) {
        for (const metadataOnly of [false, true]) {
            test(`B-E02 ${mode} ${metadataOnly ? "metadata単独" : "本文"} GET${status}`, async ({ page, editing, putEditing }, info) => {
                await putEditing(editing, metadataOnly ? { metadataStatus: status } : { status });
                const response = await page.goto(confirmPath(editing, mode));
                if (status === 401) await expect(page).toHaveURL(/\/login(?:\?|$)/);
                if (status === 404) await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
                await info.attach("error-response-status", { body: JSON.stringify({ apiStatus: status, metadataOnly, documentStatus: response?.status() }), contentType: "application/json" });
                await expect(page.getByRole("heading", { name: editing.name, exact: true })).toHaveCount(0);
                await expect(page.getByRole("button", { name: "出品する", exact: true })).toHaveCount(0);
            });
        }
    }
    test(`B-E03 ${mode} HTML風文字をSSR/DOMで実行しない`, async ({ page, editing, putEditing }) => {
        const text = '<img src=x onerror="window.__confirmXss=true"><script>window.__confirmXss=true</script>';
        editing.name = text;
        editing.title = text;
        editing.detail = text;
        editing.summary = text;
        editing.Category!.name = text;
        await putEditing(editing);
        const response = await page.request.get(confirmPath(editing, mode));
        expect(await response.text()).toContain("&lt;img");
        await openConfirm(page, editing, mode);
        await expect(page.getByRole("heading", { name: text, exact: true }).first()).toBeVisible();
        expect(await page.evaluate(() => Reflect.get(window, "__confirmXss"))).toBeUndefined();
        expect(await page.locator("main script").count()).toBe(0);
    });
    test(`B-E03 ${mode} 遅延GETと送信で成功遷移を先行しない`, async ({ page, editing, putEditing, request }) => {
        await putEditing(editing, { hold: true });
        let release!: () => void;
        const gate = new Promise<void>((resolve) => { release = resolve; });
        const requests: string[] = [];
        await page.route(/\/items(?:\?.*)?$/, async (route) => {
            requests.push(route.request().method());
            expect(route.request().postDataJSON()).toEqual({ itemEditingId: editing.id });
            await gate;
            await route.fulfill({ status: 500, json: { code: "TEST_END" } });
        });
        let navigationFinished = false;
        const navigation = page.goto(confirmPath(editing, mode)).then((response) => { navigationFinished = true; return response; });
        try {
            await expect.poll(async () => {
                const state = await (await request.get(`${apiOrigin}/__test__/state`)).json();
                return state.entries[editing.id].requests;
            }).toBeGreaterThan(0);
            expect(requests).toEqual([]);
            // Locatorの自動navigation待ちでhold/releaseをデッドロックさせない。
            expect(navigationFinished).toBe(false);
        } finally {
            await request.post(`${apiOrigin}/__test__/release/${editing.id}`);
            await navigation;
        }
        await expect(page.getByRole("link", { name: "商品を編集する", exact: true })).toBeVisible();
        await openPopup(page);
        await popup(page).getByRole("checkbox").check();
        try {
            await popup(page).getByRole("button", { name: "出品する", exact: true }).click();
            await expect.poll(() => requests.length).toBe(1);
            expect(requests).toEqual([mode === "normal" ? "POST" : "PUT"]);
            await expect(page).toHaveURL(new RegExp(`${confirmPath(editing, mode)}$`));
            await expect(page.getByText(mode === "normal" ? "商品を出品しました" : "商品情報を更新しました", { exact: true })).toHaveCount(0);
        } finally { release(); }
        await expect(page.getByText("サーバーエラーが発生しました。通信状況を確認し、もう一度ボタンをクリックしてください", { exact: true })).toBeVisible();
    });
    test(`B-O01 ${mode} キーボードとfocus・Escapeの観測`, async ({ page, editing }, info) => {
        await openConfirm(page, editing, mode);
        const opener = page.getByRole("button", { name: "出品する", exact: true });
        await opener.focus();
        await page.keyboard.press("Enter");
        await expect(popup(page)).toBeVisible();
        const focusOnOpen = await page.evaluate(() => document.activeElement?.outerHTML);
        const backKeyboard = await page.locator('svg[data-icon="angle-left"]').evaluateAll((elements) => elements.map((element) => ({ role: element.getAttribute("role"), tabIndex: element.getAttribute("tabindex"), label: element.getAttribute("aria-label") })));
        await page.keyboard.press("Tab");
        const firstTabInPopup = await popup(page).evaluate((element) => element.contains(document.activeElement));
        await page.getByRole("checkbox").focus();
        await page.keyboard.press("Space");
        await expect(page.getByRole("checkbox")).toBeChecked();
        const dialogCount = await page.getByRole("dialog").count();
        const closeButtonCount = await popup(page).getByRole("button", { name: /閉じる/ }).count();
        await page.keyboard.press("Escape");
        const escapeClosed = !(await page.getByRole("checkbox").isVisible());
        if (!escapeClosed) await popup(page).locator("svg").click();
        const focusRestored = await opener.evaluate((element) => element === document.activeElement);
        await page.getByRole("button", { name: "画像1を拡大", exact: true }).focus();
        await page.keyboard.press("Space");
        await page.getByRole("button", { name: "拡大画像を閉じる", exact: true }).press("Enter");
        await expect(page.getByRole("button", { name: "画像1を拡大", exact: true })).toBeFocused();
        await info.attach("keyboard-observation", { body: JSON.stringify({ focusOnOpen, firstTabInPopup, dialogCount, closeButtonCount, escapeClosed, focusRestored, backKeyboard }), contentType: "application/json" });
    });
    test(`B-O02 ${mode} 長文・多数variant・画像失敗・status不一致の観測`, async ({ page, editing, putEditing, errors }, info) => {
        editing.status = mode === "normal" ? "edit" : "normal";
        const largeImage = await page.evaluate(() => {
            const canvas = document.createElement("canvas");
            canvas.width = 1600;
            canvas.height = 1600;
            canvas.getContext("2d")!.fillRect(0, 0, 1600, 1600);
            return canvas.toDataURL("image/png");
        });
        editing.first_image_url = largeImage;
        editing.image_url[0] = largeImage;
        editing.original_url = "/__test__/slow-broken-video.mp4";
        await page.route("**/__test__/slow-broken-video.mp4", async (route) => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            await route.fulfill({ status: 404, body: "fixture media failure" });
        });
        editing.detail = "とても長い商品説明。".repeat(1000);
        editing.summary = "とても長い動画概要。".repeat(1000);
        editing.attributes.colorVariants = Array.from({ length: 30 }, (_, index) => ({ color: `色${index}`, image_url: "/no-image(1x1).png" }));
        await putEditing(editing);
        const failed: string[] = [];
        page.on("requestfailed", (request) => { if (["image", "media"].includes(request.resourceType())) failed.push(new URL(request.url()).pathname); });
        const started = Date.now();
        await openConfirm(page, editing, mode);
        const image = page.getByRole("img", { name: "商品画像1枚目" });
        await expect.poll(() => image.evaluate((element) => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBeTruthy();
        await expect(page.getByRole("button", { name: /^色\d+$/ })).toHaveCount(30);
        await info.attach("performance-observation", { body: JSON.stringify({ milliseconds: Date.now() - started, failed, errors, status: editing.status, mode, largeImage: { width: 1600, height: 1600 }, delayedMediaStatus: 404 }), contentType: "application/json" });
    });
}
