import { test as base, expect } from "@playwright/test";
import type { BrowserContext, Page } from "@playwright/test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openDatabase, seedDatabase } from "./database.js";
import type { Database, Row } from "./database.js";

const requireServer = createRequire(new URL("../../../../server/package.json", import.meta.url));
const { verify } = requireServer("jsonwebtoken") as { verify: (token: string, secret: string) => { id: number } };
const localURL = (value: string | undefined, label: string): URL => {
    if (!value) throw new Error(`E2E_ENV_STOP: ${label} must explicitly identify the isolated local test service`);
    const url = new URL(value);
    if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname))
        throw new Error(`E2E_ENV_STOP: ${label} must use a loopback test service`);
    return url;
};
export type Harness = {
    database: Database;
    seed: Awaited<ReturnType<typeof seedDatabase>>;
    express: URL;
    protectedBefore: (Row | null)[];
    editingRows: () => Promise<Row[]>;
    expectProtected: () => Promise<void>;
    login: (context: BrowserContext, baseURL: string) => Promise<void>;
    http: (path: string, init?: RequestInit) => Promise<Response>;
};
export const test = base.extend<{ e2e: Harness }>({
    e2e: [
        async ({ request }, provide, info) => {
            const express = localURL(process.env.ITEM_DRAFT_E2E_EXPRESS_URL, "ITEM_DRAFT_E2E_EXPRESS_URL");
            const proxy = localURL(process.env.ITEM_DRAFT_E2E_PROXY_URL, "ITEM_DRAFT_E2E_PROXY_URL");
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
                        ITEM_DRAFT_E2E_EXPRESS_PORT: express.port,
                        ITEM_DRAFT_E2E_CLIENT_ORIGIN: new URL(
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
                const seed = await seedDatabase(database, info.title.includes("E-N02"));
                const http = async (path: string, init: RequestInit = {}) => {
                    const response = await fetch(`${express.href.replace(/\/$/, "")}${path}`, init);
                    return response;
                };
                server = createServer(async (req, res) => {
                    const input = new URL(req.url ?? "/", proxy);
                    const prefix = proxy.pathname.replace(/\/$/, "");
                    const path = input.pathname.startsWith(prefix)
                        ? input.pathname.slice(prefix.length)
                        : input.pathname;
                    const match = /^\/item-draft\/(\d+)$/.exec(path);
                    if (req.method === "GET" && match) {
                        try {
                            const auth = verify(
                                (req.headers.authorization ?? "").replace(/^Bearer /, ""),
                                database.env.NEXTAUTH_SECRET,
                            );
                            const row = await database.get("item_draft", Number(match[1]));
                            if (!row || row.seller_id !== auth.id) {
                                res.writeHead(404, { "Content-Type": "application/json" });
                                res.end('{"code":"ITEM_DRAFT_NOT_FOUND"}');
                                return;
                            }
                            res.writeHead(200, { "Content-Type": "application/json" });
                            res.end(JSON.stringify({ itemDraft: { ...row, id: String(row.id) } }));
                            return;
                        } catch {
                            res.writeHead(401, { "Content-Type": "application/json" });
                            res.end('{"code":"UNAUTHORIZED"}');
                            return;
                        }
                    }
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
                            callbackUrl: `${baseURL}/item/draft/${seed.draft.id}`,
                            json: "true",
                        },
                    });
                    expect(response.ok(), "実認証が成功すること").toBeTruthy();
                    const session = (await (await context.request.get(`${baseURL}/api/auth/session`)).json()) as {
                        user?: { id?: string };
                    };
                    expect(String(session.user?.id)).toBe(String(seed.owner.id));
                };
                await provide({ database, seed, express, protectedBefore, editingRows, expectProtected, login, http });
            } finally {
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
export const openOwnedDraft = async (
    page: Page,
    context: BrowserContext,
    baseURL: string | undefined,
    e2e: Harness,
) => {
    if (!baseURL) throw new Error("E2E_ENV_STOP: baseURL missing");
    await e2e.login(context, baseURL);
    await page.goto(`/item/draft/${e2e.seed.draft.id}`);
    await expect(page.getByRole("button", { name: "編集する", exact: true })).toHaveCount(2);
};
export const authHeader = async (context: BrowserContext) => {
    const cookie = (await context.cookies()).find((cookie) => cookie.name === "access-token");
    expect(cookie, "middlewareが設定する実access-token").toBeDefined();
    return { Authorization: `Bearer ${cookie!.value}`, "Content-Type": "application/json" };
};
