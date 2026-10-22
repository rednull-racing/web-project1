import { readFileSync } from "node:fs";
import dotenv from "dotenv";

function connection(environment) {
    // Test settings never inherit a development/production DATABASE_URL.
    const values = environment === "production"
        ? process.env
        : dotenv.parse(readFileSync(new URL(
            environment === "test" ? "../.env.test" : "../.env",
            import.meta.url,
        )));
    const url = environment === "development"
        ? process.env.DATABASE_URL || values.DATABASE_URL
        : values.DATABASE_URL;
    if (!url) throw new Error(`DATABASE_URL is required for ${environment}`);

    let database;
    try {
        database = new URL(url);
    } catch {
        throw new Error(`Invalid DATABASE_URL for ${environment}`);
    }
    if (!["postgres:", "postgresql:"].includes(database.protocol) || !database.hostname) {
        throw new Error("Migration requires a PostgreSQL DATABASE_URL");
    }
    if (environment === "test" && database.pathname !== "/test_db") {
        throw new Error("Test migrations must use test_db");
    }
    return {
        url,
        dialect: "postgres",
        dialectOptions: (environment === "development" ? process.env.DB_SSL ?? values.DB_SSL : values.DB_SSL) === "true"
            ? { ssl: { require: true, rejectUnauthorized: false } }
            : {},
    };
}

// Load only the selected environment, after sequelize-cli resolves --env/NODE_ENV.
export default {
    get development() { return connection("development"); },
    get test() { return connection("test"); },
    get production() { return connection("production"); },
};
