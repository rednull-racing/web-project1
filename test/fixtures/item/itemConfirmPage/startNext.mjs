// Use a production build. The harness forwards browser API transport to isolated Express;
// API_URL below directs Server Component and NextAuth requests to the same real backend.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
if (process.argv[2] !== "e2e") throw new Error("Usage: node startNext.mjs e2e");
const project = new URL("../../../../", import.meta.url);
const client = new URL("client/", project);
const requireServer = createRequire(new URL("server/package.json", project));
const parsed = requireServer("dotenv").parse(readFileSync(new URL("server/.env.test", project)));
if (new URL(parsed.DATABASE_URL).pathname !== "/test_db" || !parsed.NEXTAUTH_SECRET)
    throw new Error("E2E_ENV_STOP: isolated test configuration required");
const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("node_modules/next/dist/bin/next", client)), "start", "--hostname", "127.0.0.1", "--port", "3032"],
    {
        cwd: fileURLToPath(client),
        env: {
            ...process.env,
            NEXTAUTH_SECRET: parsed.NEXTAUTH_SECRET,
            API_URL: "http://127.0.0.1:4043/api",
            NEXTAUTH_URL: "http://127.0.0.1:3032",
        },
        stdio: "inherit",
    },
);
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => {
    throw new Error("TEST_NEXT_STOP: Next.js startup failed");
});
child.on("exit", (code) => process.exit(code ?? 1));
