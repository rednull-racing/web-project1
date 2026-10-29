import { test as base, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { encode } from "next-auth/jwt";
import { browserDraft } from "./browserData";
import type { ItemDraft } from "../../../../src/app/item/draft/types";

export const apiOrigin = process.env.ITEM_DRAFT_BROWSER_API_URL ?? "http://127.0.0.1:4011";
export const testSecret = process.env.ITEM_DRAFT_TEST_SECRET ?? "item-draft-browser-local-fixture-secret";
export const setBrowserSession = async (context: BrowserContext, baseURL: string, owner = "7") => {
    const accessToken = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from(JSON.stringify({ id: Number(owner), exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url")}.test`;
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
    draft: ItemDraft;
    putDraft: (draft: ItemDraft, options?: { status?: number; disconnect?: boolean }) => Promise<void>;
    errors: string[];
};
export const test = base.extend<Fixture>({
    putDraft: async ({ request }, provide) => {
        await provide(async (draft, options = {}) => {
            const res = await request.post(`${apiOrigin}/__test__/draft`, { data: { draft, ...options } });
            expect(res.ok(), "起動済みのテスト用APIサーバーが必要").toBeTruthy();
        });
    },
    draft: async ({ context, baseURL, putDraft }, provide, info) => {
        if (!baseURL) throw new Error("BROWSER_TEST_STOP: baseURL missing");
        const id = String(
            10000 +
                info.workerIndex * 1000 +
                info.repeatEachIndex * 100 +
                info.testId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0),
        );
        const draft = browserDraft({ id: Number(id) });
        await putDraft(draft);
        await setBrowserSession(context, baseURL);
        await provide(draft);
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
export const openDraft = async (page: Page, draft: ItemDraft) => {
    await page.goto(`/item/draft/${draft.id}`);
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(2);
};
