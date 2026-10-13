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
        const url = new URL(parsed.DATABASE_URL);
        if (!/^postgres(?:ql)?:$/.test(url.protocol) || url.pathname !== "/test_db") throw new Error();
    } catch {
        throw new Error("DB_TEST_STOP: .env.test must specify PostgreSQL test_db; user decision required");
    }
    for (const [key, value] of Object.entries(parsed)) vi.stubEnv(key, value);
    vi.stubEnv("DB_SSL", parsed.DB_SSL ?? "false");
    if (process.env.NODE_ENV !== "test") throw new Error("DB_TEST_STOP: .env.test changed NODE_ENV");
    return { path, parsed, resolve };
});

// db.tsの明示指定とmodels/configの引数なしconfigを、同じ検証済み設定へ限定する。
vi.mock("dotenv", () => ({ default: {
    config: (options?: { path?: string | string[] }) => {
        if (options?.path && (typeof options.path !== "string" || environment.resolve(options.path) !== environment.path)) {
            throw new Error("DB_TEST_STOP: non-.env.test access; user decision required");
        }
        if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== environment.parsed.DATABASE_URL
            || process.env.DB_SSL !== (environment.parsed.DB_SSL ?? "false")) {
            throw new Error("DB_TEST_STOP: connection environment changed; user decision required");
        }
        return { parsed: environment.parsed };
    },
} }));

// HTTP→DB結合でcontrollerがimportする、対象外usecaseの外部通信を読み込まない。
vi.mock("../../../../src/usecases/itemEditing/createItemEditing.js", () => ({ createItemEditingUseCase: vi.fn() }));
vi.mock("../../../../src/usecases/itemEditing/updateConfirm.js", () => ({ updateItemEditingConfirmUseCase: vi.fn() }));

export const assertEnvironment = () => {
    if (process.env.NODE_ENV !== "test" || process.env.DATABASE_URL !== environment.parsed.DATABASE_URL
        || process.env.DB_SSL !== (environment.parsed.DB_SSL ?? "false")) {
        throw new Error("DB_TEST_STOP: connection environment changed; user decision required");
    }
};
