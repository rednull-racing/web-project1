import type { DotenvConfigOptions, DotenvConfigOutput } from "dotenv";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    config: vi.fn<(options?: DotenvConfigOptions) => DotenvConfigOutput>(),
    sequelize: vi.fn(function () {}),
}));
vi.mock("dotenv", () => ({ default: { config: mocks.config } }));
vi.mock("sequelize", () => ({ Sequelize: mocks.sequelize }));

const testUrl = "postgres://tester:fixture-password@localhost/test_db";
const otherUrl = "postgres://tester:fixture-password@localhost/other_db";
const options = { dialect: "postgres", logging: false, dialectOptions: {} };
const load = (parsed: Record<string, string>) => {
    mocks.config.mockImplementation(() => {
        for (const [key, value] of Object.entries(parsed)) vi.stubEnv(key, value);
        return { parsed };
    });
};
const rejectInitialization = async (message: string) => {
    await expect(import("../db.js")).rejects.toThrow(message);
    expect(mocks.sequelize).not.toHaveBeenCalled();
};

beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("DATABASE_URL", undefined);
    vi.stubEnv("DB_SSL", "false");
    vi.stubEnv("DOCKER", undefined);
    load({ DATABASE_URL: testUrl });
});
afterEach(() => vi.unstubAllEnvs());

describe("P0: .env.test読込み後の接続先検証", () => {
    it.each([undefined, testUrl, otherUrl])("N01: 親URL=%sでもファイルのtest_dbを採用する", async (parent) => {
        vi.stubEnv("DATABASE_URL", parent);
        const { default: connection } = await import("../db.js");
        expect(mocks.config).toHaveBeenCalledExactlyOnceWith({ path: ".env.test", override: true });
        expect(mocks.sequelize).toHaveBeenCalledExactlyOnceWith(testUrl, options);
        expect(connection).toBe(mocks.sequelize.mock.instances[0]);
    });

    it("E01: 読込み失敗時は親の正常URLで続行しない", async () => {
        vi.stubEnv("DATABASE_URL", testUrl);
        mocks.config.mockReturnValue({ error: new Error("private file details"), parsed: { DATABASE_URL: testUrl } });
        await rejectInitialization("Failed to load .env.test!");
    });
    it.each<Record<string, string> | undefined>([undefined, {}, { DATABASE_URL: "" }])(
        "E01: parsed=%jは親の正常URLで続行しない",
        async (parsed) => {
            vi.stubEnv("DATABASE_URL", testUrl);
            mocks.config.mockReturnValue({ parsed });
            await rejectInitialization("DATABASE_URL is not set in .env.test!");
        },
    );

    it.each([
        ["not-a-url-with-private-details", "Invalid test DATABASE_URL!"],
        ["postgres://tester:private@localhost/other_db", "Test environment must use PostgreSQL test_db!"],
        ["https://localhost/test_db", "Test environment must use PostgreSQL test_db!"],
        ["mysql://localhost/test_db", "Test environment must use PostgreSQL test_db!"],
        ["postgres:///test_db", "Test environment must use PostgreSQL test_db!"],
        ["postgres://localhost/test_db/extra", "Test environment must use PostgreSQL test_db!"],
    ])("E02: ファイル内の不正接続先=%sをURLを公開せず拒否する", async (url, message) => {
        vi.stubEnv("DATABASE_URL", testUrl);
        load({ DATABASE_URL: url });
        await expect(import("../db.js")).rejects.toMatchObject({ message });
        expect(mocks.sequelize).not.toHaveBeenCalled();
    });

    it("N01: postgresqlプロトコルも許可する", async () => {
        const url = "postgresql://localhost/test_db";
        load({ DATABASE_URL: url });
        await import("../db.js");
        expect(mocks.sequelize).toHaveBeenCalledExactlyOnceWith(url, options);
    });
    it.each([undefined, otherUrl])("E03: parsedと最終URL=%sの不一致を拒否する", async (finalUrl) => {
        vi.stubEnv("DATABASE_URL", finalUrl);
        mocks.config.mockReturnValue({ parsed: { DATABASE_URL: testUrl } });
        await rejectInitialization("Test database environment changed!");
    });
    it("E03: ファイル内のNODE_ENV上書きを拒否する", async () => {
        load({ DATABASE_URL: testUrl, NODE_ENV: "production" });
        await rejectInitialization("Test database environment changed!");
    });
    it("N02: ファイルのDB_SSL=trueを接続オプションへ渡す", async () => {
        load({ DATABASE_URL: testUrl, DB_SSL: "true" });
        await import("../db.js");
        expect(mocks.sequelize).toHaveBeenCalledExactlyOnceWith(testUrl, {
            ...options,
            dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
        });
    });
});

describe("P1: test以外の初期化の回帰", () => {
    it("R01: ローカルdevelopmentは.envを読む", async () => {
        vi.stubEnv("NODE_ENV", "development");
        load({ DATABASE_URL: otherUrl });
        await import("../db.js");
        expect(mocks.config).toHaveBeenCalledExactlyOnceWith({ path: ".env" });
        expect(mocks.sequelize).toHaveBeenCalledExactlyOnceWith(otherUrl, options);
    });
    it.each(["production", "docker"])("R01: %sでは既存環境変数を使用する", async (mode) => {
        vi.stubEnv("NODE_ENV", mode === "production" ? "production" : "development");
        vi.stubEnv("DOCKER", mode === "docker" ? "true" : undefined);
        vi.stubEnv("DATABASE_URL", otherUrl);
        await import("../db.js");
        expect(mocks.config).not.toHaveBeenCalled();
        expect(mocks.sequelize).toHaveBeenCalledExactlyOnceWith(otherUrl, options);
    });
    it("R01: productionでURL未設定なら生成前に停止する", async () => {
        vi.stubEnv("NODE_ENV", "production");
        await rejectInitialization("DATABASE_URL is not set!");
    });
});
