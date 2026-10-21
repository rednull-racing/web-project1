import { vi } from "vitest";

const environment = await vi.hoisted(async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dotenv = await vi.importActual<typeof import("dotenv")>("dotenv");
    const path = resolve(".env.test");
    if (process.env.NODE_ENV !== "test") throw new Error("DB_TEST_STOP: NODE_ENV must be test");
    let parsed: Record<string, string>;
    try {
        parsed = dotenv.parse(readFileSync(path));
    } catch {
        throw new Error("DB_TEST_STOP: cannot read server/.env.test; user decision required");
    }
    try {
        const url = new URL(parsed.DATABASE_URL);
        if (!["postgres:", "postgresql:"].includes(url.protocol) || decodeURIComponent(url.pathname) !== "/test_db") {
            throw new Error();
        }
    } catch {
        throw new Error("DB_TEST_STOP: .env.test must specify PostgreSQL test_db; user decision required");
    }
    if (parsed.NODE_ENV && parsed.NODE_ENV !== "test") {
        throw new Error("DB_TEST_STOP: .env.test NODE_ENV mismatch; user decision required");
    }
    for (const [key, value] of Object.entries(parsed)) vi.stubEnv(key, value);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DB_SSL", parsed.DB_SSL ?? "false");
    return { path, parsed, resolve };
});
vi.mock("dotenv", () => ({
    default: {
        config: (options?: { path?: string; override?: boolean }) => {
            if (options?.path && environment.resolve(options.path) !== environment.path) {
                throw new Error("DB_TEST_STOP: non-.env.test access; user decision required");
            }
            if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== environment.parsed.DATABASE_URL) {
                throw new Error("DB_TEST_STOP: verified environment changed; user decision required");
            }
            return { parsed: environment.parsed };
        },
    },
}));
// Routerの他usecaseのimportに伴うAWS初期化も外部境界で止める。
vi.mock("../../../../src/infra/aws/s3.js", () => ({ publicS3Domain: "https://media.test" }));
vi.mock("../../../../src/utils/s3/index.js", () => ({
    generateSignedUrl: vi.fn(),
    createVideoPresignedPost: vi.fn(),
}));
