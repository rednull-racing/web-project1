import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
const client = new URL("../../../../", import.meta.url);
const child = spawn(
    process.execPath,
    [
        fileURLToPath(new URL("node_modules/next/dist/bin/next", client)),
        "start",
        "--hostname",
        "127.0.0.1",
        "--port",
        process.env.ITEM_CONFIRM_BROWSER_NEXT_PORT ?? "3031",
    ],
    {
        cwd: fileURLToPath(client),
        env: {
            ...process.env,
            API_URL: process.env.ITEM_CONFIRM_BROWSER_API_URL ?? "http://127.0.0.1:4031",
            NEXTAUTH_SECRET: process.env.ITEM_CONFIRM_TEST_SECRET ?? "item-confirm-browser-local-fixture-secret",
            NEXTAUTH_URL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3031",
        },
        stdio: "inherit",
    },
);
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => {
    throw new Error("TEST_NEXT_STOP: startup failed");
});
child.on("exit", (code) => process.exit(code ?? 1));
