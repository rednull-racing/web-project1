import { test as base, expect } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { openDatabase } from "./database.js";

type Database = Awaited<ReturnType<typeof openDatabase>>;
type Seed = Awaited<ReturnType<Database["seed"]>>;
type Harness = {
    database: Database;
    seed: Seed;
    api: string;
    login: (context: BrowserContext) => Promise<void>;
    unchanged: () => Promise<void>;
};
const clientURL = "http://127.0.0.1:3021";
const api = "http://127.0.0.1:4321/api";
export const test = base.extend<{ trash: Harness }>({
    trash: [
        async ({}, provide) => {
            const database = await openDatabase();
            const server = spawn(
                process.execPath,
                [
                    "--import",
                    fileURLToPath(new URL("../../../../server/node_modules/tsx/dist/loader.mjs", import.meta.url)),
                    fileURLToPath(new URL("./serverProcess.mjs", import.meta.url)),
                ],
                {
                    env: {
                        ...process.env,
                        ITEM_TRASH_E2E_EXPRESS_PORT: "4321",
                        ITEM_TRASH_E2E_CLIENT_ORIGIN: clientURL,
                    },
                    stdio: "ignore",
                },
            );
            const next = spawn(
                process.execPath,
                [
                    fileURLToPath(new URL("../../../../client/node_modules/next/dist/bin/next", import.meta.url)),
                    "start",
                    "--hostname",
                    "127.0.0.1",
                    "--port",
                    "3021",
                ],
                {
                    cwd: fileURLToPath(new URL("../../../../client/", import.meta.url)),
                    env: {
                        ...process.env,
                        NEXTAUTH_SECRET: database.env.NEXTAUTH_SECRET,
                        NEXTAUTH_URL: clientURL,
                        API_URL: api,
                    },
                    stdio: "ignore",
                },
            );
            try {
                await expect
                    .poll(
                        async () => {
                            if (server.exitCode !== null || next.exitCode !== null)
                                throw new Error(
                                    "E2E_ENV_STOP: production Next/Express failed to start; check dedicated build log",
                                );
                            try {
                                const proof = (await (
                                    await fetch("http://127.0.0.1:4321/__test__/database-proof")
                                ).json()) as { database?: string };
                                return proof.database === "test_db" && (await fetch(`${clientURL}/api/auth/csrf`)).ok;
                            } catch {
                                return false;
                            }
                        },
                        { timeout: 15000, message: "production Next and real Express/test_db must be ready" },
                    )
                    .toBe(true);
                const seed = await database.seed();
                const before = (
                    await database.db.query(
                        "SELECT * FROM item_trash WHERE seller_id=ANY($1::int[]) OR id=$2 ORDER BY id",
                        [[seed.owner, seed.other], seed.rows[22].id],
                    )
                ).rows;
                const unchanged = async () =>
                    expect(
                        (
                            await database.db.query(
                                "SELECT * FROM item_trash WHERE seller_id=ANY($1::int[]) OR id=$2 ORDER BY id",
                                [[seed.owner, seed.other], seed.rows[22].id],
                            )
                        ).rows,
                    ).toEqual(before);
                const login = async (context: BrowserContext) => {
                    const { csrfToken } = (await (await context.request.get(`${clientURL}/api/auth/csrf`)).json()) as {
                        csrfToken: string;
                    };
                    const response = await context.request.post(`${clientURL}/api/auth/callback/credentials`, {
                        form: {
                            csrfToken,
                            email: seed.email,
                            password: seed.password,
                            rememberMe: "false",
                            callbackUrl: `${clientURL}/item-list/trash`,
                            json: "true",
                        },
                    });
                    if (!response.ok()) {
                        const probe = await context.request.post(`${api}/auth/login`, {
                            data: { email: seed.email, password: seed.password, rememberMe: false },
                        });
                        const data = (await probe.json().catch(() => ({}))) as { code?: string; error?: string };
                        throw new Error(
                            `E2E_AUTH_STOP: NextAuth HTTP ${response.status()}; direct login HTTP ${probe.status()}; code=${data.code ?? data.error ?? "none"}`,
                        );
                    }
                    const session = (await (await context.request.get(`${clientURL}/api/auth/session`)).json()) as {
                        user?: { id?: string };
                    };
                    expect(String(session.user?.id)).toBe(String(seed.owner));
                };
                await provide({ database, seed, api, login, unchanged });
            } finally {
                for (const child of [next, server]) {
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
                }
                await database.cleanup();
            }
        },
        { auto: true },
    ],
});
export { expect };
export const listURL = `${clientURL}/item-list/trash`;
export const authHeader = async (context: BrowserContext) => {
    const cookie = (await context.cookies()).find((cookie) => cookie.name === "access-token");
    expect(cookie, "actual middleware access-token").toBeDefined();
    return { Authorization: `Bearer ${cookie!.value}` };
};
