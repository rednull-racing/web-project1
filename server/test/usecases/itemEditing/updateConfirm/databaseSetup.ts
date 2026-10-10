import { vi } from "vitest";

const environment = await vi.hoisted(async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const dotenv = await vi.importActual<typeof import("dotenv")>("dotenv");
    const path = resolve(".env.test");
    const parsed = dotenv.parse(readFileSync(path));
    if (process.env.NODE_ENV !== "test") throw new Error("DB_TEST_STOP: NODE_ENV must be test");
    if (!parsed.DATABASE_URL || new URL(parsed.DATABASE_URL).pathname !== "/test_db") {
        throw new Error("DB_TEST_STOP: .env.test must specify test_db; user decision required");
    }
    for (const [key, value] of Object.entries(parsed)) vi.stubEnv(key, value);
    vi.stubEnv("DB_SSL", parsed.DB_SSL ?? "false");
    if (process.env.NODE_ENV !== "test") throw new Error("DB_TEST_STOP: .env.test changed NODE_ENV");
    return { path, parsed, resolve };
});

// models/index と config の引数なしconfig()も .env を開かず、検証済みの値だけを返す。
vi.mock("dotenv", () => ({
    default: {
        config: (options?: { path?: string; override?: boolean }) => {
            if (options?.path && environment.resolve(options.path) !== environment.path) {
                throw new Error("DB_TEST_STOP: non-.env.test access requested; user decision required");
            }
            if (process.env.DATABASE_URL !== environment.parsed.DATABASE_URL) {
                throw new Error("DB_TEST_STOP: DATABASE_URL changed; user decision required");
            }
            return { parsed: environment.parsed };
        },
    },
}));

vi.mock("../../../../src/infra/aws/s3.js", () => ({ publicS3Domain: "https://media.test" }));
vi.mock("../../../../src/utils/s3/index.js", () => ({
    generateSignedUrl: vi.fn(async ({ key }: { key: string }) => `https://signed.test/${key}`),
    createVideoPresignedPost: vi.fn(async ({ key }: { key: string }) => ({
        url: "https://upload.test",
        fields: { key },
    })),
}));
