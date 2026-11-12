import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
const root = new URL("../../../../server/", import.meta.url);
const requireServer = createRequire(new URL("package.json", root));
type Row = { id: number; [key: string]: unknown };
interface Client {
    connect(): Promise<void>;
    query<T extends Record<string, unknown> = Row>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
}
const { Client: PgClient } = requireServer("pg") as {
    Client: new (options: {
        connectionString: string;
        ssl: false | { rejectUnauthorized: boolean };
        connectionTimeoutMillis: number;
    }) => Client;
};
const { parse } = requireServer("dotenv") as { parse: (input: Buffer) => Record<string, string> };
const { hash } = requireServer("bcrypt") as { hash: (password: string, rounds: number) => Promise<string> };
export const openDatabase = async () => {
    const env = parse(readFileSync(new URL(".env.test", root)));
    if (new URL(env.DATABASE_URL).pathname !== "/test_db" || !env.NEXTAUTH_SECRET)
        throw new Error("E2E_ENV_STOP: isolated test_db/auth configuration required");
    const db = new PgClient({
        connectionString: env.DATABASE_URL,
        ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 3000,
    });
    try {
        await db.connect();
        if ((await db.query<{ name: string }>("SELECT current_database() AS name")).rows[0].name !== "test_db")
            throw new Error("database mismatch");
        const columns = (
            await db.query<{ column_name: string; data_type: string; is_nullable: string }>(
                "SELECT column_name,data_type,is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='item_trash'",
            )
        ).rows;
        for (const name of [
            "id",
            "item_id",
            "seller_id",
            "name",
            "price",
            "first_image_url",
            "title",
            "attributes",
            "gender_type",
            "age_type",
            "createdAt",
            "updatedAt",
        ])
            if (!columns.some((column) => column.column_name === name)) throw new Error("item_trash columns mismatch");
        for (const name of ["id", "item_id", "seller_id", "price"])
            if (columns.find((column) => column.column_name === name)?.data_type !== "integer")
                throw new Error("item_trash integer mismatch");
        for (const name of ["name", "price", "first_image_url", "title"])
            if (columns.find((column) => column.column_name === name)?.is_nullable !== "YES")
                throw new Error("item_trash nullable mismatch");
    } catch {
        await db.end().catch(() => undefined);
        throw new Error("E2E_ENV_STOP: trash test_db connection/schema guard failed; no seed performed");
    }
    const owners: number[] = [];
    const trashIds: number[] = [];
    const cleanup = async () => {
        try {
            if (trashIds.length) await db.query("DELETE FROM item_trash WHERE id=ANY($1::int[])", [trashIds]);
            if (owners.length) {
                await db.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1::int[])", [owners]);
                await db.query('DELETE FROM "user" WHERE id=ANY($1::int[])', [owners]);
            }
        } finally {
            await db.end();
        }
    };
    const seed = async () => {
        const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
        const password = `Test${suffix}9!`;
        const encrypted = await hash(password, 4);
        for (const prefix of ["owner", "other"]) {
            const result = await db.query(
                'INSERT INTO "user" (email,password,email_verified,"createdAt","updatedAt") VALUES ($1,$2,true,NOW(),NOW()) RETURNING *',
                [`trash-${prefix}-${suffix}@example.test`, encrypted],
            );
            owners.push(result.rows[0].id);
        }
        const created = new Date();
        const rows: Row[] = [];
        for (let index = 0; index < 23; index++) {
            const result = await db.query(
                'INSERT INTO item_trash (seller_id,name,price,first_image_url,title,"createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *',
                [
                    index < 21 ? owners[0] : index === 21 ? owners[1] : null,
                    index === 2 ? "検索%文字" : index === 3 ? "検索_文字" : `削除商品${index}`,
                    1000 + index,
                    "/no-image(1x1).png",
                    index === 4 ? "動画検索専用" : `動画${index}`,
                    index === 0 ? new Date(created.getTime() - 45 * 86400000) : created,
                ],
            );
            trashIds.push(result.rows[0].id);
            rows.push(result.rows[0]);
        }
        return { owner: owners[0], other: owners[1], password, email: `trash-owner-${suffix}@example.test`, rows };
    };
    return { db, env, cleanup, seed };
};
