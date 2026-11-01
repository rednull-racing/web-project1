import { test as base, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { browserEditing, type BrowserEditing } from "./browserData";

export const apiOrigin = process.env.ITEM_CONFIRM_BROWSER_API_URL ?? "http://127.0.0.1:4031";
export const testSecret = process.env.ITEM_CONFIRM_TEST_SECRET ?? "item-confirm-browser-local-fixture-secret";
export type Options = {
    status?: number;
    metadataStatus?: number;
    metadataName?: string | null;
    allowForeign?: boolean;
    hold?: boolean;
    delayMs?: number;
};
export const setBrowserSession = async (context: BrowserContext, baseURL: string, owner = "7", expired = false) => {
    const accessToken = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: Number(owner), exp: Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600) })).toString("base64url")}.test`;
    const session = await encode({
        secret: testSecret,
        token: { id: owner, accessToken, refreshToken: "test-refresh-token" },
        maxAge: 3600,
    });
    await context.addCookies([
        { name: "next-auth.session-token", value: session, url: baseURL, httpOnly: true, sameSite: "Lax" },
        { name: "access-token", value: accessToken, url: baseURL, sameSite: "Lax" },
    ]);
};
type Fixture = {
    editing: BrowserEditing;
    putEditing: (editing: BrowserEditing, options?: Options) => Promise<void>;
    errors: string[];
};
export const test = base.extend<Fixture>({
    putEditing: async ({ request }, provide) => {
        await provide(async (editing, options = {}) => {
            const result = await request.post(`${apiOrigin}/__test__/editing`, { data: { editing, ...options } });
            expect(result.ok(), "専用テストAPIサーバーの起動が必要").toBeTruthy();
        });
    },
    editing: async ({ context, baseURL, putEditing }, provide, info) => {
        if (!baseURL) throw new Error("BROWSER_TEST_STOP: baseURL missing");
        const editing = browserEditing({
            id:
                10000 +
                info.workerIndex * 1000 +
                info.testId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0),
        });
        await putEditing(editing);
        await setBrowserSession(context, baseURL);
        await provide(editing);
    },
    errors: [
        async ({ page }, provide) => {
            const errors: string[] = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error" && /hydration|did not match|server rendered/i.test(message.text()))
                    errors.push(message.text());
            });
            await provide(errors);
        },
        { auto: true },
    ],
});
export { expect };
export const confirmPath = (editing: BrowserEditing, mode: "normal" | "edit") =>
    `/item/confirm/${mode === "edit" ? "edit/" : ""}${editing.id}`;
export const openConfirm = async (page: Page, editing: BrowserEditing, mode: "normal" | "edit") => {
    await page.goto(confirmPath(editing, mode));
    await expect(page.getByRole("link", { name: "商品を編集する", exact: true })).toBeVisible();
};
export const popup = (page: Page) => page.locator('[class*="popup"]').filter({ has: page.getByRole("checkbox") });
export const openPopup = async (page: Page) => {
    await page.getByRole("button", { name: "出品する", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "この商品は利用規約を遵守しております。" })).toBeVisible();
};
