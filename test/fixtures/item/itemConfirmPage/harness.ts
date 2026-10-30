import { test as base, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openDatabase, seedConfirm } from "./database.js";
import type { Database, Row } from "./database.js";

const localURL = (value: string | undefined, label: string): URL => {
    if (!value) throw new Error(`E2E_ENV_STOP: ${label} must explicitly identify the isolated local test service`);
    const url = new URL(value);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname))
        throw new Error(`E2E_ENV_STOP: ${label} must use a loopback test service`);
    return url;
};
export type Harness = {
    getResponses: Array<{ path: string; status: number; body: Record<string, unknown> }>;
    database: Database;
    seed: Awaited<ReturnType<typeof seedConfirm>>;
    express: URL;
    protectedBefore: (Row | null)[];
    editingRows: () => Promise<Row[]>;
    expectProtected: () => Promise<void>;
    login: (context: BrowserContext, baseURL: string) => Promise<void>;
    http: (path: string, init?: RequestInit) => Promise<Response>;
};
export const test = base.extend<{ e2e: Harness }>({
    e2e: [
        async ({ request, context }, provide, info) => {
            const express = localURL(process.env.ITEM_CONFIRM_E2E_EXPRESS_URL, "ITEM_CONFIRM_E2E_EXPRESS_URL");
            const proxy = localURL(process.env.ITEM_CONFIRM_E2E_PROXY_URL, "ITEM_CONFIRM_E2E_PROXY_URL");
            const database = await openDatabase();
            const ownerIds: number[] = [];
            let server: ReturnType<typeof createServer> | undefined;
            const child = spawn(
                process.execPath,
                [
                    "--import",
                    fileURLToPath(new URL("../../../../server/node_modules/tsx/dist/loader.mjs", import.meta.url)),
                    fileURLToPath(new URL("./serverProcess.mjs", import.meta.url)),
                ],
                {
                    env: {
                        ...process.env,
                        ITEM_CONFIRM_E2E_EXPRESS_PORT: express.port,
                        ITEM_CONFIRM_E2E_CLIENT_ORIGIN: new URL(
                            process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
                        ).origin,
                    },
                    stdio: "ignore",
                },
            );
            try {
                await expect
                    .poll(
                        async () => {
                            if (child.exitCode !== null)
                                throw new Error("E2E_ENV_STOP: isolated Express startup failed");
                            try {
                                const proof = (await (
                                    await fetch(`${express.origin}/__test__/database-proof`)
                                ).json()) as { database?: string };
                                return proof.database;
                            } catch {
                                return "unavailable";
                            }
                        },
                        { timeout: 15000, message: "isolated Express must verify its own test_db connection" },
                    )
                    .toBe("test_db");
                // Track owners even if seed fails halfway, so cleanup never depends on a completed seed.
                const insert = database.insert;
                database.insert = async (table, data) => {
                    const row = await insert(table, data);
                    if (table === "user") ownerIds.push(row.id);
                    return row;
                };
                const seed = await seedConfirm(database);
                const http = async (path: string, init: RequestInit = {}) => {
                    const response = await fetch(`${express.href.replace(/\/$/, "")}${path}`, init);
                    return response;
                };
                const getResponses: Harness["getResponses"] = [];
                const traffic: Array<{ path: string; status: number; type: string | null }> = [];
                server = createServer(async (req, res) => {
                    const input = new URL(req.url ?? "/", proxy);
                    const prefix = proxy.pathname.replace(/\/$/, "");
                    const path = input.pathname.startsWith(prefix)
                        ? input.pathname.slice(prefix.length)
                        : input.pathname;
                    try {
                        const chunks: Buffer[] = [];
                        for await (const chunk of req) chunks.push(Buffer.from(chunk));
                        const headers = new Headers();
                        for (const key of ["authorization", "content-type", "cookie"])
                            if (req.headers[key]) headers.set(key, String(req.headers[key]));
                        const response = await http(`${path}${input.search}`, {
                            method: req.method,
                            headers,
                            body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : Buffer.concat(chunks),
                        });
                        traffic.push({ path, status: response.status, type: response.headers.get("content-type") });
                        if (req.method === "GET" && /^\/item-editing\/\d+\/(?:confirm|metadata)$/.test(path)) {
                            getResponses.push({ path, status: response.status, body: await response.clone().json() as Record<string, unknown> });
                        }
                        res.writeHead(response.status, {
                            "Content-Type": response.headers.get("content-type") ?? "application/json",
                        });
                        res.end(Buffer.from(await response.arrayBuffer()));
                    } catch {
                        res.writeHead(502, { "Content-Type": "application/json" });
                        res.end('{"code":"TEST_UPSTREAM_UNAVAILABLE"}');
                    }
                });
                await new Promise<void>((resolve, reject) => {
                    server!.once("error", reject);
                    server!.listen(Number(proxy.port), proxy.hostname, resolve);
                });
                const protectedBefore = await Promise.all([
                    database.get("item_draft", seed.otherDraft.id),
                    database.get("item_draft", seed.sameOwnerDraft.id),
                    database.get("item_editing", seed.existingEditing.id),
                ]);
                const mastersBefore = await Promise.all(
                    seed.masters.map(
                        async ({ table, row }) =>
                            (await database.db.query<Row>(`SELECT * FROM "${table}" WHERE id=$1`, [row.id])).rows[0],
                    ),
                );
                const editingRows = async () =>
                    (
                        await database.db.query<Row>(
                            "SELECT * FROM item_editing WHERE seller_id=$1 AND id<>$2 ORDER BY id",
                            [seed.owner.id, seed.existingEditing.id],
                        )
                    ).rows;
                const expectProtected = async () => {
                    for (const [table, row] of [["item", seed.protectedItem], ["video", seed.protectedVideo], ["sale", seed.protectedSale], ["item_shipping_profile", seed.protectedShipping]] as const) {
                        expect((await database.db.query<Row>(`SELECT * FROM "${table}" WHERE id=$1`, [row.id])).rows[0]).toEqual(row);
                    }
                    expect(
                        await Promise.all([
                            database.get("item_draft", seed.otherDraft.id),
                            database.get("item_draft", seed.sameOwnerDraft.id),
                            database.get("item_editing", seed.existingEditing.id),
                        ]),
                    ).toEqual(protectedBefore);
                    expect(
                        await Promise.all(
                            seed.masters.map(
                                async ({ table, row }) =>
                                    (await database.db.query<Row>(`SELECT * FROM "${table}" WHERE id=$1`, [row.id]))
                                        .rows[0],
                            ),
                        ),
                    ).toEqual(mastersBefore);
                };
                // Forward browser transport to real Express; business responses remain unmodified.
                await context.route("**/*", async route => {
                    const url = new URL(route.request().url());
                    const nextOrigin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3032").origin;
                    if (url.origin === nextOrigin || !url.pathname.includes("/api/")) return route.continue();
                    const path = url.pathname.slice(url.pathname.indexOf("/api/") + 4);
                    const result = await http(path + url.search, {
                        method: route.request().method(), headers: route.request().headers(),
                        body: ["GET", "HEAD"].includes(route.request().method()) ? undefined : route.request().postData() ?? undefined,
                    });
                    await route.fulfill({ status: result.status, headers: {
                        "content-type": result.headers.get("content-type") ?? "application/json",
                        "access-control-allow-origin": nextOrigin, "access-control-allow-credentials": "true",
                    }, body: Buffer.from(await result.arrayBuffer()) });
                });
                const login = async (context: BrowserContext, baseURL: string) => {
                    const csrf = await context.request.get(`${baseURL}/api/auth/csrf`);
                    expect(csrf.ok(), "NextAuth csrf endpoint").toBeTruthy();
                    const { csrfToken } = (await csrf.json()) as { csrfToken: string };
                    const response = await context.request.post(`${baseURL}/api/auth/callback/credentials`, {
                        form: {
                            csrfToken,
                            email: String(seed.owner.email),
                            password: seed.password,
                            rememberMe: "false",
                            callbackUrl: `${baseURL}/item/confirm/${seed.normal.id}`,
                            json: "true",
                        },
                    });
                    expect(response.ok(), "実認証が成功すること").toBeTruthy();
                    const session = (await (await context.request.get(`${baseURL}/api/auth/session`)).json()) as {
                        user?: { id?: string };
                    };
                    expect(String(session.user?.id)).toBe(String(seed.owner.id));
                };
                try {
                    await provide({ getResponses, database, seed, express, protectedBefore, editingRows, expectProtected, login, http });
                } finally {
                    await info.attach("real-api-traffic", { body: JSON.stringify(traffic), contentType: "application/json" });
                }
            } finally {
                await context.unrouteAll({ behavior: "wait" });
                if (server)
                    await new Promise<void>((resolve, reject) =>
                        server!.close((error) => (error ? reject(error) : resolve())),
                    );
                child.kill("SIGTERM");
                if (child.exitCode === null)
                    await new Promise<void>((resolve) => {
                        const timeout = setTimeout(() => {
                            child.kill("SIGKILL");
                            resolve();
                        }, 3000);
                        child.once("exit", () => {
                            clearTimeout(timeout);
                            resolve();
                        });
                    });
                await database.cleanup(ownerIds);
            }
            void request;
        },
        { auto: true },
    ],
});
export { expect };
export const openConfirm = async (
    page: Page, context: BrowserContext, baseURL: string | undefined, e2e: Harness, mode: "normal" | "edit",
) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL missing");
    await e2e.login(context, baseURL);
    const editing = mode === "normal" ? e2e.seed.normal : e2e.seed.edit;
    await page.goto(`/item/confirm/${mode === "edit" ? "edit/" : ""}${editing.id}`);
    await expect(page.getByRole("button", { name: "出品する", exact: true })).toBeVisible();
};
export const submit = async (page: Page) => {
    await page.getByRole("button", { name: "出品する", exact: true }).click();
    await page.getByRole("checkbox", { name: "この商品は利用規約を遵守しております。" }).check();
    await page.getByRole("button", { name: "出品する", exact: true }).last().click();
};
export const snapshot = async (e2e: Harness) => {
    const owners = [e2e.seed.owner.id, e2e.seed.other.id];
    const result = await e2e.database.db.query<Row>(`
        SELECT jsonb_build_object('items', (SELECT jsonb_agg(i ORDER BY id) FROM item i WHERE seller_id=ANY($1::int[])),
        'editing', (SELECT jsonb_agg(e ORDER BY id) FROM item_editing e WHERE seller_id=ANY($1::int[])),
        'video', (SELECT jsonb_agg(v ORDER BY v.id) FROM video v JOIN item i ON i.video_id=v.id WHERE i.seller_id=ANY($1::int[])),
        'sale', (SELECT jsonb_agg(s ORDER BY s.id) FROM sale s JOIN item i ON i.sale_id=s.id WHERE i.seller_id=ANY($1::int[])),
        'shipping', (SELECT jsonb_agg(s ORDER BY s.id) FROM item_shipping_profile s JOIN item i ON i.shipping_id=s.id WHERE i.seller_id=ANY($1::int[]))) AS data`, [owners]);
    return result.rows[0].data;
};
export const authHeader = async (context: BrowserContext) => {
    const cookie = (await context.cookies()).find((cookie) => cookie.name === "access-token");
    expect(cookie, "middlewareが設定する実access-token").toBeDefined();
    return { Authorization: `Bearer ${cookie!.value}`, "Content-Type": "application/json" };
};
