import dotenv from "dotenv";
import { Sequelize } from "sequelize";

if (process.env.NODE_ENV === "test") {
    // 親processの設定へフォールバックせず、読み込んだ最終値を検査する。
    const result = dotenv.config({
        path: ".env.test",
        override: true,
    });
    if (result.error) {
        throw new Error("Failed to load .env.test!");
    }
    if (!result.parsed?.DATABASE_URL) {
        throw new Error("DATABASE_URL is not set in .env.test!");
    }
    const databaseUrl = process.env.DATABASE_URL;
    if (process.env.NODE_ENV !== "test" || databaseUrl !== result.parsed.DATABASE_URL) {
        throw new Error("Test database environment changed!");
    }

    let database: URL;
    try {
        database = new URL(databaseUrl);
    } catch {
        // URLパーサーの例外には接続情報が含まれるため、そのまま公開しない。
        throw new Error("Invalid test DATABASE_URL!");
    }
    if (
        !["postgres:", "postgresql:"].includes(database.protocol) ||
        !database.hostname ||
        database.pathname !== "/test_db"
    ) {
        throw new Error("Test environment must use PostgreSQL test_db!");
    }
} else if (!process.env.DOCKER && process.env.NODE_ENV !== "production") {
    // ローカル開発環境
    dotenv.config({ path: ".env" });
}

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set!");
}

const isSSL = process.env.DB_SSL === "true";

const sequelize = new Sequelize(process.env.DATABASE_URL!, {
    dialect: "postgres",
    logging: false,
    dialectOptions: isSSL
        ? {
              ssl: {
                  require: true,
                  rejectUnauthorized: false,
              },
          }
        : {},
});

export default sequelize;
