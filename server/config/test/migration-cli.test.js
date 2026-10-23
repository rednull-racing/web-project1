import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import config from "../config.js";

const server = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(new URL("../../node_modules/sequelize-cli/package.json", import.meta.url));
const Umzug = require("umzug");

test("direct CLI and npm options load ESM options on Node 26", () => {
    for (const command of ["db:migrate", "db:migrate:undo", "migration:generate"]) {
        for (const options of [[], ["--options-path", "config/cli-options.json"]]) {
            const result = spawnSync(
                process.execPath,
                ["node_modules/sequelize-cli/lib/sequelize", ...options, command, "--help"],
                { cwd: server, encoding: "utf8" },
            );
            assert.equal(result.status, 0, result.stderr);
        }
    }
});

test("test config ignores inherited DATABASE_URL and uses test_db", () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgres://localhost/production";
    try {
        assert.equal(new URL(config.test.url).pathname, "/test_db");
    } finally {
        if (previous === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = previous;
    }
});

test("CLI selects test configuration for --env and NODE_ENV", () => {
    for (const args of [["--env", "test"], []]) {
        const result = spawnSync(
            process.execPath,
            [
                "--input-type=module",
                "-e",
                `
            import helpers from './node_modules/sequelize-cli/lib/helpers/index.js';
            await helpers.config.init();
            const config = helpers.config.readConfig();
            if (config.database !== 'test_db') process.exit(1);
        `,
                "--",
                ...args,
            ],
            {
                cwd: server,
                encoding: "utf8",
                env: { ...process.env, NODE_ENV: "test", DATABASE_URL: "postgres://localhost/production" },
            },
        );
        assert.equal(result.status, 0, "CLI test environment selection failed");
    }
});

test("installed Umzug invokes existing ESM up/down and preserves migration filenames in history", async () => {
    const directory = mkdtempSync(join(tmpdir(), "sequelize-esm-"));
    const queries = [];
    const transaction = {};
    const queryInterface = {
        sequelize: {
            transaction: async (callback) => callback(transaction),
            query: async (sql, options) => {
                assert.equal(options.transaction, transaction);
                queries.push(sql);
            },
        },
    };
    const name = "20261021071500-enforce-item-timestamps-not-null.js";
    const migrator = new Umzug({
        storage: "json",
        storageOptions: { path: join(directory, "history.json") },
        migrations: {
            path: join(server, "migrations"),
            pattern: /^20261021071500-enforce-item-timestamps-not-null\.js$/,
            params: [queryInterface],
        },
    });
    try {
        await migrator.up();
        assert.deepEqual(
            (await migrator.executed()).map((entry) => entry.file),
            [name],
        );
        await migrator.up();
        assert.equal(queries.length, 1);
        await migrator.down();
        assert.deepEqual(await migrator.executed(), []);
        assert.equal(queries.length, 2);
        assert.match(queries[0], /SET NOT NULL/);
        assert.match(queries[1], /DROP NOT NULL/);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});

test("Sequelize history storage adds/removes only the selected filename", async () => {
    const Storage = require("umzug/lib/storages/SequelizeStorage").default;
    const existing = "20261022080000-enforce-user-timestamps-not-null.js";
    const selected = "compatibility-probe.js";
    const names = new Set([existing]);
    const model = {
        sequelize: { modelManager: {} },
        sync: async () => model,
        create: async ({ name }) => names.add(name),
        destroy: async ({ where }) => names.delete(where.name),
        findAll: async () => [...names].sort().map((name) => ({ name })),
    };
    const storage = new Storage({ model });
    await storage.logMigration(selected);
    assert.deepEqual(await storage.executed(), [existing, selected].sort());
    await storage.unlogMigration(selected);
    assert.deepEqual(await storage.executed(), [existing]);
});
