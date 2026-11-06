import "../../../../fixtures/itemTrash/getItemTrashList/databaseSetup.js";
import { describe, expect, it, vi } from "vitest";
import { QueryTypes } from "sequelize";
import { seed, ItemTrash, observer, deferred, sequelize } from "../../../../fixtures/itemTrash/getItemTrashList/databaseFixtures.js";
import { getItemTrashListUseCase as run } from "../../../../../src/usecases/itemTrash/getItemTrashList.js";
import * as queries from "../../../../../src/services/itemTrash/query.js";

describe("P0 実DBの本人限定・ページ・snapshot", () => {
    it("D01: 本人のname/title OR、null列、降順、0/20/21件・範囲外・再送", async () => {
        const { owner, other } = await seed();
        const rows = [];
        for (let i = 0; i < 21; i++) rows.push(await ItemTrash.create({ seller_id: owner.id, name: i % 2 ? "aしゃつ" : null, title: i % 2 ? null : "aしゃつ", createdAt: new Date("2026-11-06T00:00:00Z") }));
        const newest = await ItemTrash.create({ seller_id: owner.id, name: "別商品", createdAt: new Date("2026-11-07T00:00:00Z") });
        await ItemTrash.create({ seller_id: other.id, name: "aしゃつ" });
        await ItemTrash.create({ seller_id: null, name: "aしゃつ" });
        const input = { userId: owner.id, page: 1, keyword: "Ａ シャツ" };
        const first = await run(input);
        expect(first.totalPages).toBe(2);
        expect(first.itemTrashList.map((r) => r.itemTrash.id)).toEqual(rows.slice(1).reverse().map((r) => r.id));
        expect(Object.keys(JSON.parse(JSON.stringify(first.itemTrashList[0].itemTrash))).sort()).toEqual(["createdAt", "first_image_url", "id", "name", "price", "title"]);
        expect(first.itemTrashList[0].itemTrash.price).toBeNull();
        expect((await run({ ...input, page: 2 })).itemTrashList.map((r) => r.itemTrash.id)).toEqual([rows[0].id]);
        expect(await run({ ...input, page: 3 })).toEqual({ itemTrashList: [], totalPages: 2 });
        expect(await run({ ...input, keyword: "不一致" })).toEqual({ itemTrashList: [], totalPages: 0 });
        expect((await run({ ...input, keyword: null })).itemTrashList[0].itemTrash.id).toBe(newest.id);
        expect((await run(input)).itemTrashList.map((r) => r.itemTrash.id)).toEqual(first.itemTrashList.map((r) => r.itemTrash.id));
        expect(await ItemTrash.count({ where: { seller_id: owner.id } })).toBe(22);
    });
    it.each(["%", "_", "\\"])("D01: 検索語%sをワイルドカードにせず文字一致", async (keyword) => {
        const { owner } = await seed();
        const match = await ItemTrash.create({ seller_id: owner.id, name: "a" + keyword + "b" });
        await ItemTrash.create({ seller_id: owner.id, name: "aXb" });
        const result = await run({ userId: owner.id, page: 1, keyword });
        expect(result.itemTrashList.map((r) => r.itemTrash.id)).toEqual([match.id]);
        expect(result.totalPages).toBe(1);
    });
    it("D01: 20件一致なら1ページ、全null列もそのまま返す", async () => {
        const { owner } = await seed();
        for (let i = 0; i < 20; i++) await ItemTrash.create({ seller_id: owner.id });
        const result = await run({ userId: owner.id, page: 1, keyword: null });
        expect(result.itemTrashList).toHaveLength(20); expect(result.totalPages).toBe(1);
        expect(result.itemTrashList[0].itemTrash.name).toBeNull();
        expect(result.itemTrashList[0].itemTrash.title).toBeNull();
        expect(await run({ userId: owner.id, page: 2, keyword: null })).toEqual({ itemTrashList: [], totalPages: 1 });
    });
    it("D02: 一覧後に別接続が削除commitしてもcountは同snapshot、次要求は最新", async () => {
        const { owner } = await seed();
        const row = await ItemTrash.create({ seller_id: owner.id, name: "snapshot" });
        const reached = deferred<undefined>(); const release = deferred<undefined>();
        const original = queries.getMyItemTrashList;
        vi.spyOn(queries, "getMyItemTrashList").mockImplementationOnce(async (params) => {
            const rows = await original(params);
            const [settings] = await observer.query<{ isolation: string }>("SELECT current_setting('transaction_isolation') AS isolation", { type: QueryTypes.SELECT });
            expect(settings.isolation).toBe("read committed");
            const [actual] = await sequelize.query<{ isolation: string; readonly: string }>("SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS readonly", { transaction: params.transaction, type: QueryTypes.SELECT });
            expect(actual).toEqual({ isolation: "repeatable read", readonly: "on" });
            reached.resolve(undefined); await release.promise; return rows;
        });
        const input = { userId: owner.id, page: 1, keyword: null };
        const pending = run(input);
        try {
            await Promise.race([reached.promise, pending.then(() => { throw new Error("gate not reached"); })]);
            await observer.query('DELETE FROM item_trash WHERE id=:id', { replacements: { id: row.id } });
        } finally { release.resolve(undefined); await pending; }
        const result = await pending;
        expect(result.itemTrashList.map((r) => r.itemTrash.id)).toEqual([row.id]); expect(result.totalPages).toBe(1);
        expect(await run(input)).toEqual({ itemTrashList: [], totalPages: 0 });
    });
});
