import { test as base, expect, authHeader } from "../draft/backendHarness.js";
import type { Row } from "../../item/itemDraftPage/database.js";

// The existing harness uses real NextAuth, production /items router and guarded test_db.
export const test = base.extend<{ stock: { rows: Row[]; unchanged: () => Promise<void> } }>({
    stock: async ({ e2e }, provide) => {
        const rows: Row[] = [];
        try {
            for (let i = 0; i < 23; i++) {
                const result = await e2e.database.db.query<Row>(
                    `INSERT INTO item (seller_id,name,price,status,gender_type,age_type,search_text,attributes,uploaded_at,"createdAt","updatedAt")
                     VALUES ($1,$2,$3,$4,'unisex','both',$5,$6,$7,$7,$7) RETURNING *`,
                    [
                        i === 21 ? e2e.seed.other.id : i === 22 ? null : e2e.seed.owner.id,
                        `在庫商品${i}`,
                        1234,
                        i % 2 ? "soldout" : "active",
                        i === 0 ? "検索%通常" : "検索商品",
                        JSON.stringify(
                            i === 0
                                ? {}
                                : { inventory: { initial: 2000, current: i === 1 ? 0 : 1234, low_stock_ratio: 0.2 } },
                        ),
                        "2026-11-10T00:00:00Z",
                    ],
                );
                rows.push(result.rows[0]);
            }
            const unchanged = async () => {
                expect(
                    (
                        await e2e.database.db.query<Row>("SELECT * FROM item WHERE id=ANY($1::int[]) ORDER BY id", [
                            rows.map((row) => row.id),
                        ])
                    ).rows,
                ).toEqual(rows);
                await e2e.expectProtected();
            };
            await provide({ rows, unchanged });
        } finally {
            if (rows.length)
                await e2e.database.db.query("DELETE FROM item WHERE id=ANY($1::int[])", [rows.map((row) => row.id)]);
        }
    },
});
export { expect, authHeader };
