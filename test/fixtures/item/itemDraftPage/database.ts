import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const serverRoot = new URL("../../../../server/", import.meta.url);
const requireServer = createRequire(new URL("package.json", serverRoot));
interface Client {
    connect(): Promise<void>;
    query<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
    end(): Promise<void>;
}
const { Client: PgClient } = requireServer("pg") as { Client: new (options: { connectionString: string; ssl: false | { rejectUnauthorized: boolean }; connectionTimeoutMillis: number }) => Client };
const { parse } = requireServer("dotenv") as { parse: (value: Buffer) => Record<string, string> };
const { hash } = requireServer("bcrypt") as { hash: (value: string, rounds: number) => Promise<string> };
export const copyColumns = ["name", "detail", "image_url", "price", "item_condition_id", "first_image_url", "gender_type", "age_type", "recommend", "category_id", "brand_id", "brand_aliases_id", "attributes", "thumbnail_url", "title", "summary", "duration", "original_url", "converted_url", "video_status", "before_price", "discount_rate", "discount_amount", "sale_flag", "shipping_day_id", "shipping_service_id", "shipping_place_id", "shipping_service_free_text"] as const;
export type Row = Record<string, unknown> & { id: number };
export type Database = Awaited<ReturnType<typeof openDatabase>>;
export const openDatabase = async () => {
    let env: Record<string, string>;
    try { env = parse(readFileSync(new URL(".env.test", serverRoot))); }
    catch { throw new Error("E2E_ENV_STOP: server/.env.test is required; no database operations performed"); }
    let connection: URL;
    try { connection = new URL(env.DATABASE_URL); }
    catch { throw new Error("E2E_ENV_STOP: invalid database setting"); }
    if (!["postgres:", "postgresql:"].includes(connection.protocol) || connection.pathname !== "/test_db") throw new Error("E2E_ENV_STOP: database must be test_db");
    const db = new PgClient({ connectionString: env.DATABASE_URL, ssl: env.DB_SSL === "true" ? { rejectUnauthorized: false } : false, connectionTimeoutMillis: 3000 });
    try {
        await db.connect();
        const result = await db.query<{ name: string }>("SELECT current_database() AS name");
        if (result.rows[0]?.name !== "test_db") throw new Error("wrong database");
        for (const table of ["item_draft", "item_editing"] as const) {
            const columns = await db.query<{ column_name: string; data_type: string; udt_name: string; is_nullable: string; character_maximum_length: number | null }>("SELECT column_name,data_type,udt_name,is_nullable,character_maximum_length FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1", [table]);
            if (!["id", "seller_id", "createdAt", "updatedAt", ...copyColumns].every((name) => columns.rows.some((column) => column.column_name === name))) throw new Error(`schema mismatch ${table}`);
            const byName = new Map(columns.rows.map((column) => [column.column_name, column]));
            for (const name of ["id", "seller_id", "price", "item_condition_id", "category_id", "brand_id", "brand_aliases_id", "duration", "before_price", "discount_rate", "discount_amount", "shipping_day_id", "shipping_service_id", "shipping_place_id"]) if (byName.get(name)?.data_type !== "integer") throw new Error(`integer type mismatch ${table}`);
            if (byName.get("attributes")?.udt_name !== "jsonb" || byName.get("image_url")?.udt_name !== "_text") throw new Error(`JSON/array type mismatch ${table}`);
            for (const name of ["recommend", "sale_flag"]) if (byName.get(name)?.data_type !== "boolean") throw new Error(`boolean type mismatch ${table}`);
            for (const name of ["name", "title", "video_status", "shipping_service_free_text"]) if (byName.get(name)?.character_maximum_length !== 255) throw new Error(`string length mismatch ${table}`);
            for (const name of ["name", "detail", "image_url", "price", "recommend", "thumbnail_url", "title", "summary", "duration", "original_url", "converted_url", "video_status", "before_price", "discount_rate", "discount_amount"]) if (byName.get(name)?.is_nullable !== "YES") throw new Error(`nullable mismatch ${table}`);
            const foreignKeys = await db.query<{ column_name: string; target: string; delete_action: string; update_action: string }>(`
                SELECT a.attname AS column_name,target.relname AS target,c.confdeltype AS delete_action,c.confupdtype AS update_action
                FROM pg_constraint c JOIN pg_class source ON source.oid=c.conrelid
                JOIN pg_namespace n ON n.oid=source.relnamespace JOIN pg_class target ON target.oid=c.confrelid
                JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
                WHERE c.contype='f' AND source.relname=$1 AND n.nspname=current_schema()`, [table]);
            const targets = { seller_id: "user", item_condition_id: "item_condition_option", category_id: "categories", brand_id: "brands", brand_aliases_id: "brand_aliases", shipping_day_id: "shipping_day_option", shipping_service_id: "shipping_service_option", shipping_place_id: "todouhuken_option" };
            for (const [name, target] of Object.entries(targets)) {
                const fk = foreignKeys.rows.find((key) => key.column_name === name);
                if (!fk || fk.target !== target || fk.update_action !== "a" || fk.delete_action !== (name.startsWith("brand") ? "n" : "a")) throw new Error(`foreign key mismatch ${table}.${name}`);
            }

        }
    } catch {
        await db.end().catch(() => undefined);
        throw new Error("E2E_ENV_STOP: test_db connection/schema verification failed; no seed performed");
    }
    if (!env.NEXTAUTH_SECRET) { await db.end(); throw new Error("E2E_ENV_STOP: test server signing secret missing"); }
    const created: Array<{ table: string; id: number }> = [];
    const insert = async (table: string, data: Record<string, unknown>): Promise<Row> => {
        const permitted = ["user", "categories", "item_condition_option", "shipping_day_option", "shipping_service_option", "todouhuken_option", "brands", "brand_aliases", "item_draft", "item_editing"];
        if (!permitted.includes(table) || Object.keys(data).some((key) => !/^[a-zA-Z_]+$/.test(key))) throw new Error("invalid fixture table/column");
        const timestamps = ["user", "item_draft", "item_editing"].includes(table) ? { createdAt: new Date("2020-01-01T00:00:00Z"), updatedAt: new Date("2020-01-02T00:00:00Z") } : {};
        const entries = Object.entries({ ...data, ...timestamps });
        const result = await db.query<Row>(`INSERT INTO "${table}" (${entries.map(([key]) => `"${key}"`).join(",")}) VALUES (${entries.map((_, index) => `$${index + 1}`).join(",")}) RETURNING *`, entries.map(([key, value]) => key === "attributes" ? JSON.stringify(value) : value));
        created.push({ table, id: result.rows[0].id });
        return result.rows[0];
    };
    const get = async (table: "item_draft" | "item_editing" | "user", id: number) => (await db.query<Row>(`SELECT * FROM "${table}" WHERE id=$1`, [id])).rows[0] ?? null;
    const cleanup = async (owners: number[]) => {
        // The server creates editing rows after seed; identify only this case's new owners.
        try {
            if (owners.length) {
                await db.query("DELETE FROM item_editing WHERE seller_id=ANY($1::int[])", [owners]);
                await db.query("DELETE FROM item_draft WHERE seller_id=ANY($1::int[])", [owners]);
                await db.query("DELETE FROM refresh_tokens WHERE user_id=ANY($1::int[])", [owners]);
            }
            for (const entry of [...created].reverse()) {
                await db.query(`DELETE FROM "${entry.table}" WHERE id=$1`, [entry.id]);
                if ((await db.query(`SELECT id FROM "${entry.table}" WHERE id=$1`, [entry.id])).rows.length) throw new Error("cleanup left fixture rows");
            }
        } finally { await db.end(); }
    };
    return { db, insert, get, cleanup, env };
};
export const seedDatabase = async (database: Database, empty = false) => {
    const { insert } = database;
    const suffix = randomUUID().replaceAll("-", ""); const password = `Test${suffix}9!`; const hashed = await hash(password, 4);
    const owner = await insert("user", { email: `draft-${suffix}@example.test`, password: hashed, email_verified: true });
    const other = await insert("user", { email: `draft-other-${suffix}@example.test`, password: hashed, email_verified: true });
    const category = await insert("categories", { name: suffix, path: suffix, level: 1, body_category: "top", lifestyle_category: "casual", layer: "middle" });
    const condition = await insert("item_condition_option", { name: "新品" });
    const day = await insert("shipping_day_option", { name: "翌日" });
    const service = await insert("shipping_service_option", { name: "宅配便" });
    const place = await insert("todouhuken_option", { name: "東京都" });
    const brand = await insert("brands", { name: suffix, name_normalized: suffix });
    const alias = await insert("brand_aliases", { brand_id: brand.id, name: suffix, name_normalized: suffix });
    const data = {
        name: empty ? null : "下書きシャツ", detail: empty ? null : "商品説明", image_url: empty ? null : ["/no-image(1x1).png"],
        price: empty ? null : 800, item_condition_id: condition.id, seller_id: owner.id, first_image_url: empty ? null : "/no-image(1x1).png",
        gender_type: "men", age_type: "adult", recommend: empty ? null : true, category_id: category.id, brand_id: brand.id, brand_aliases_id: alias.id,
        attributes: empty ? {} : { inventory: { initial: 10, current: 4, low_stock_ratio: 0.2 }, materials: [{ name: "綿", ratio: 100 }] },
        thumbnail_url: null, title: empty ? null : "動画タイトル", summary: empty ? null : "動画概要", duration: null, original_url: null, converted_url: null, video_status: null,
        before_price: empty ? null : 1200, discount_rate: empty ? null : 25, discount_amount: empty ? null : 400, sale_flag: !empty,
        shipping_day_id: day.id, shipping_service_id: service.id, shipping_place_id: place.id, shipping_service_free_text: empty ? null : "自由記述配送",
    };
    const draft = await insert("item_draft", data);
    const otherDraft = await insert("item_draft", { ...data, seller_id: other.id, name: "他人の下書き" });
    const sameOwnerDraft = await insert("item_draft", { ...data, name: "別の下書き" });
    const existingEditing = await insert("item_editing", { ...data, item_id: null, status: "normal", name: "既存の編集" });
    return { owner, other, draft, otherDraft, sameOwnerDraft, existingEditing, masters: [{ table: "categories", row: category }, { table: "item_condition_option", row: condition }, { table: "shipping_day_option", row: day }, { table: "shipping_service_option", row: service }, { table: "todouhuken_option", row: place }, { table: "brands", row: brand }, { table: "brand_aliases", row: alias }], password, owners: [owner.id, other.id] };
};
