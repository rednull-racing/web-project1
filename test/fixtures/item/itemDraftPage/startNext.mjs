// Reuse the same production build; NEXT_PUBLIC_API_URL must be fixed to the local E2E URL at build time.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const mode = process.argv[2];
if (!["browser", "e2e"].includes(mode)) throw new Error("Usage: node startNext.mjs browser|e2e");
const project = new URL("../../../../", import.meta.url);
const client = new URL("client/", project);
const env = { ...process.env };
if (mode === "e2e") {
    const requireServer = createRequire(new URL("server/package.json", project));
    const parsed = requireServer("dotenv").parse(readFileSync(new URL("server/.env.test", project)));
    if (new URL(parsed.DATABASE_URL).pathname !== "/test_db" || !parsed.NEXTAUTH_SECRET) throw new Error("E2E_ENV_STOP: isolated test configuration required");
    env.NEXTAUTH_SECRET = parsed.NEXTAUTH_SECRET;
    env.API_URL = "http://127.0.0.1:4022/api";
    env.NEXTAUTH_URL = "http://127.0.0.1:3012";
} else {
    env.API_URL = "http://127.0.0.1:4011";
    env.NEXTAUTH_SECRET = process.env.ITEM_DRAFT_TEST_SECRET ?? "item-draft-browser-local-fixture-secret";
    env.NEXTAUTH_URL = "http://127.0.0.1:3011";
}
const child = spawn(process.execPath, [fileURLToPath(new URL("node_modules/next/dist/bin/next", client)), "start", "--hostname", "127.0.0.1", "--port", mode === "e2e" ? "3012" : "3011"], { cwd: fileURLToPath(client), env, stdio: "inherit" });
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => { throw new Error("TEST_NEXT_STOP: Next.js startup failed"); });
child.on("exit", (code) => process.exit(code ?? 1));
