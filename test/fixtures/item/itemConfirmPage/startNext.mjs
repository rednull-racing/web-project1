// Production Next plus an optional local TLS frontend: Secure cookies must remain secure.
// Browser API transport is forwarded by the harness to isolated real Express.
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:https";
import { request } from "node:http";
if (process.argv[2] !== "e2e") throw new Error("Usage: node startNext.mjs e2e");
const project = new URL("../../../../", import.meta.url);
const client = new URL("client/", project);
const requireServer = createRequire(new URL("server/package.json", project));
const parsed = requireServer("dotenv").parse(readFileSync(new URL("server/.env.test", project)));
if (new URL(parsed.DATABASE_URL).pathname !== "/test_db" || !parsed.NEXTAUTH_SECRET)
    throw new Error("E2E_ENV_STOP: isolated test configuration required");
const tlsURL = process.env.ITEM_CONFIRM_E2E_TLS_URL ? new URL(process.env.ITEM_CONFIRM_E2E_TLS_URL) : null;
if (tlsURL && (tlsURL.protocol !== "https:" || !["localhost", "127.0.0.1"].includes(tlsURL.hostname) || !tlsURL.port))
    throw new Error("E2E_ENV_STOP: TLS frontend must be an explicit local HTTPS service");
let certificateDirectory;
let frontend;
if (tlsURL) {
    certificateDirectory = mkdtempSync(join(tmpdir(), "confirm-e2e-tls-"));
    const key = join(certificateDirectory, "key.pem");
    const cert = join(certificateDirectory, "cert.pem");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-sha256", "-days", "1", "-nodes", "-keyout", key, "-out", cert, "-subj", "/CN=localhost", "-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"], { stdio: "ignore" });
    frontend = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
        const upstream = request({ hostname: "127.0.0.1", port: 3032, path: req.url, method: req.method,
            headers: { ...req.headers, "x-forwarded-proto": "https", "x-forwarded-host": tlsURL.host } }, response => {
            res.writeHead(response.statusCode ?? 502, response.headers);
            response.pipe(res);
        });
        upstream.on("error", () => { res.writeHead(502); res.end("TEST_NEXT_UNAVAILABLE"); });
        req.pipe(upstream);
    });
    frontend.listen(Number(tlsURL.port), tlsURL.hostname);
}
const child = spawn(process.execPath,
    [fileURLToPath(new URL("node_modules/next/dist/bin/next", client)), "start", "--hostname", "127.0.0.1", "--port", "3032"],
    { cwd: fileURLToPath(client), env: { ...process.env, NEXTAUTH_SECRET: parsed.NEXTAUTH_SECRET,
        API_URL: "http://127.0.0.1:4043/api", NEXTAUTH_URL: tlsURL?.origin ?? "http://127.0.0.1:3032" }, stdio: "inherit" });
const cleanup = () => {
    frontend?.close();
    if (certificateDirectory) rmSync(certificateDirectory, { recursive: true, force: true });
};
process.on("SIGTERM", () => child.kill("SIGTERM"));
process.on("SIGINT", () => child.kill("SIGINT"));
child.on("error", () => { cleanup(); throw new Error("TEST_NEXT_STOP: Next.js startup failed"); });
child.on("exit", code => { cleanup(); process.exit(code ?? 1); });
