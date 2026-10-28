import { test, expect, openDraft } from "../../../../fixtures/item/itemDraftPage/browser";
test("B-N02 概要と説明の開閉・スクロールで集計しない", async ({ page, draft }) => {
    const requests: string[] = [];
    page.on("request", (request) => {
        if (/\/video\/[^/]+\/onplay|\/items\/[^/]+\/sort-number\/add/.test(request.url())) requests.push(request.url());
    });
    await openDraft(page, draft);
    const more = page.getByRole("button", { name: "...もっと見る", exact: true });
    await expect(more).toHaveCount(2);
    await more.first().click();
    await expect(page.getByRole("button", { name: "閉じる", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    await more.nth(1).click();
    await page.getByRole("button", { name: "商品説明へスクロール" }).click();
    await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toBeInViewport();
    expect(requests).toEqual([]);
});
test("B-N03 画像拡大と色カード開閉", async ({ page, draft }) => {
    await openDraft(page, draft);
    await page.locator(".swiper-pagination-bullet").nth(1).click();
    await page.getByRole("img", { name: "Slide 2", exact: true }).click();
    await expect(page.locator('[class*="sliderModal"] .swiper-slide-active img')).toHaveAttribute(
        "alt",
        "全画面スライド 2",
    );
    await page
        .getByRole("img", { name: "全画面スライド 2", exact: true })
        .locator("xpath=ancestor::div[contains(@class, 'overlay')]")
        .locator(":scope > svg")
        .click();
    await expect(page.getByRole("img", { name: "全画面スライド 2", exact: true })).toHaveCount(0);
    const card = page.locator('[class*="variantCard"]').filter({ hasText: "赤" });
    await card.click();
    await expect(card).toHaveClass(/active/);
    const blue = page.locator('[class*="variantCard"]').filter({ hasText: "青" });
    await blue.click();
    await expect(blue).toHaveClass(/active/);
    await expect(card).not.toHaveClass(/active/);
    await blue.click();
    await expect(blue).not.toHaveClass(/active/);
    const slider = page.locator(".swiper").first();
    const box = (await slider.boundingBox())!;
    const before = await slider.locator(".swiper-slide-active img").getAttribute("alt");
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(slider.locator(".swiper-slide-active img")).not.toHaveAttribute("alt", before!);
});
test("Q05 削除開始と商品概要がキーボード操作可能", async ({ page, draft }) => {
    await openDraft(page, draft);
    const opener = page.getByRole("button", { name: "この下書き商品を削除する", exact: true });
    await expect(opener).toBeVisible();
    await opener.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "削除する", exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    const peek = page.getByRole("button", { name: "商品説明へスクロール" });
    await peek.focus();
    await expect(peek).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByRole("heading", { name: draft.name!, exact: true })).toBeInViewport();
});
test("Q06 削除確認dialog・focus trap・Escape・復帰", async ({ page, draft }) => {
    await openDraft(page, draft);
    const opener = page.getByText("この下書き商品を削除する", { exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "確認" });
    await expect(dialog).toBeVisible();
    for (let index = 0; index < 5; index++) {
        await page.keyboard.press(index % 2 === 0 ? "Tab" : "Shift+Tab");
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
    }
    for (let index = 0; index < 5; index++) {
        await page.keyboard.press("Shift+Tab");
        expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBeTruthy();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
});
test("Q08 拡大画像と色カードがキーボード操作可能", async ({ page, draft }) => {
    await openDraft(page, draft);
    const imageButton = page.getByRole("button", { name: /画像.*拡大|Slide 2/ }).first();
    await expect(imageButton).toBeVisible();
    await imageButton.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: /閉じる/ }).click();
    const variant = page.getByRole("button", { name: /赤/ });
    await variant.focus();
    await page.keyboard.press("Space");
    await expect(variant).toHaveAttribute("aria-expanded", "true");
});
test("B-O01 メディア読込と操作時間の記録", async ({ page, draft }, info) => {
    const failed: string[] = [];
    page.on("requestfailed", (request) => {
        if (["image", "media"].includes(request.resourceType())) failed.push(new URL(request.url()).pathname);
    });
    const started = Date.now();
    await openDraft(page, draft);
    const image = page.getByRole("img", { name: "商品画像1枚目" });
    await expect(image).toBeVisible();
    await expect
        .poll(() =>
            image.evaluate(
                (element) => (element as HTMLImageElement).complete && (element as HTMLImageElement).naturalWidth > 0,
            ),
        )
        .toBeTruthy();
    expect(failed).toEqual([]);
    await info.attach("media-and-operation", {
        body: JSON.stringify({ milliseconds: Date.now() - started, failed }),
        contentType: "application/json",
    });
});

for (const current of [1, 2]) {
    test(`Q07 少量在庫current=${current}の実表示`, async ({ page, draft, putDraft }) => {
        draft.attributes = { inventory: { initial: 4, current, low_stock_ratio: 0.2 } };
        await putDraft(draft);
        await openDraft(page, draft);
        await expect(page.getByText(current === 1 ? "残りわずか" : "在庫あり", { exact: true })).toBeVisible();
    });
}
for (const current of [0, 2, 3, 4]) {
    test(`Q09 個別在庫閾値current=${current}の実表示`, async ({ page, draft, putDraft }) => {
        draft.attributes = {
            colorVariants: [
                {
                    color: "赤",
                    image_url: "/no-image(1x1).png",
                    inventory: { initial: 10, current, low_stock_ratio: 0.3 },
                    sizes: [{ size: "M", inventory: { initial: 10, current, low_stock_ratio: 0.3 } }],
                },
            ],
        };
        await putDraft(draft);
        await openDraft(page, draft);
        const low = current > 0 && current <= 3;
        await expect(page.getByText("残りわずか", { exact: true })).toHaveCount(low ? 1 : 0);
        const size = page.getByText("M", { exact: true });
        if (low) await expect(size).toHaveClass(/lowChip/);
        else await expect(size).not.toHaveClass(/lowChip/);
    });
}
for (const emptyConverted of [false, true]) {
    test(`${emptyConverted ? "Q10" : "B-N02"} 元動画の実再生と集計未送信`, async ({
        page,
        draft,
        putDraft,
        baseURL,
    }) => {
        // ブラウザーで短いcanvas動画を生成し、外部CDN・永続アセットに依存させない。
        const clip = await page.evaluate(async () => {
            const canvas = document.createElement("canvas");
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext("2d")!;
            ctx.fillStyle = "red";
            ctx.fillRect(0, 0, 64, 64);
            const stream = canvas.captureStream(10);
            const mimeType = ["video/webm;codecs=vp8", "video/mp4"].find((type) => MediaRecorder.isTypeSupported(type));
            if (!mimeType) throw new Error("MEDIA_FIXTURE_STOP: supported recording codec missing");
            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks: Blob[] = [];
            const stopped = new Promise<void>((resolve, reject) => {
                recorder.ondataavailable = (event) => chunks.push(event.data);
                recorder.onstop = () => resolve();
                recorder.onerror = () => reject(new Error("media fixture encoding failed"));
            });
            recorder.start();
            const interval = setInterval(() => {
                ctx.fillStyle = ctx.fillStyle === "#ff0000" ? "blue" : "red";
                ctx.fillRect(0, 0, 64, 64);
            }, 50);
            setTimeout(() => {
                clearInterval(interval);
                recorder.stop();
                stream.getTracks().forEach((track) => track.stop());
            }, 400);
            await stopped;
            const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
            return { body: btoa(String.fromCharCode(...bytes)), mimeType };
        });
        const requests: string[] = [];
        page.on("request", (request) => {
            if (/\/onplay|\/sort-number\/add/.test(request.url())) requests.push(request.url());
        });
        draft.original_url = new URL("/__test__/draft-video", baseURL).href;
        draft.converted_url = emptyConverted ? "" : null;
        await page.route("**/__test__/draft-video", (route) =>
            route.fulfill({ status: 200, body: Buffer.from(clip.body, "base64"), contentType: clip.mimeType }),
        );
        await putDraft(draft);
        await openDraft(page, draft);
        const video = page.locator("video");
        await expect(video).toHaveAttribute("src", draft.original_url);
        await video.evaluate(async (element) => {
            if (!(element instanceof HTMLVideoElement)) throw new Error("video element required");
            element.muted = true;
            await element.play();
        });
        await expect
            .poll(() => video.evaluate((element) => (element instanceof HTMLVideoElement ? element.currentTime : 0)))
            .toBeGreaterThan(0);
        expect(requests).toEqual([]);
    });
}
