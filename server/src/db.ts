import dotenv from "dotenv";
import { Sequelize } from "sequelize";

if (process.env.NODE_ENV === "test") {
    // テスト環境
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("DATABASE_URL is not set!");
    }

    const dbName = new URL(databaseUrl).pathname.slice(1);

    if (dbName !== "test_db") {
        throw new Error("Test environment must use test_db!");
    }
    
    dotenv.config({
        path: ".env.test",
        override: true,
    });
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
