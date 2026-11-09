import "../../../../fixtures/items/getUploadedItemList/databaseSetup.js";
import { describe, expect, it, vi } from "vitest";
import { QueryTypes, Transaction } from "sequelize";
import {
    seed, Item, Video, Sale, observer, deferred, sequelize, createItem, snapshotCreated,
} from "../../../../fixtures/items/getUploadedItemList/databaseFixtures.js";
import { getUploadedItemListUseCase as run } from "../../../../../src/usecases/items/list/getUploadedItemList.js";
import * as queries from "../../../../../src/services/items/query/list/userItemList.js";

describe("P0 実DBの出品一覧・認可・snapshot", () => {
    it("D01: search_text検索・本人限定・status・uploaded_at/id降順・21件のページ境界・再送・非対象不変", async () => {
        const { owner, other } = await seed();
        const rows = [];
        for (let i = 0; i < 21; i++) rows.push(await createItem({
            seller_id: owner.id, name: "名前は別の文字", search_text: "aしゃつ", status: i % 2 ? "soldout" : "active",
            createdAt: new Date("2026-11-30T00:00:00Z"),
        }));
        const newest = await createItem({
            seller_id: owner.id, search_text: "別商品", uploaded_at: new Date("2026-11-07T00:00:00Z"),
            createdAt: new Date("2026-01-01T00:00:00Z"),
        });
        await createItem({ seller_id: other.id, search_text: "aしゃつ" });
        await createItem({ seller_id: null, search_text: "aしゃつ" });
        await createItem({ seller_id: owner.id, search_text: null, name: "aしゃつ" });
        const before = await snapshotCreated();
        const input = { userId: owner.id, page: 1, status: undefined, keyword: "Ａ シャツ" };
        const first = await run(input);
        const ids = rows.slice().reverse().map((r) => r.id);
        expect(first.totalPages).toBe(2);
        expect(first.itemList.map((r) => r.item.id)).toEqual(ids.slice(0, 20));
        expect((await run({ ...input, page: 2 })).itemList.map((r) => r.item.id)).toEqual([rows[0].id]);
        expect(await run({ ...input, page: 3 })).toEqual({ itemList: [], totalPages: 2 });
        expect(await run({ ...input, keyword: "不一致" })).toEqual({ itemList: [], totalPages: 0 });
        const active = await run({ ...input, status: "active" });
        expect(active.itemList.map((r) => r.item.id)).toEqual(rows.filter((_, i) => i % 2 === 0).reverse().map((r) => r.id));
        expect(active.totalPages).toBe(1);
        const soldout = await run({ ...input, status: "soldout" });
        expect(soldout.itemList.map((r) => r.item.id)).toEqual(rows.filter((_, i) => i % 2 === 1).reverse().map((r) => r.id));
        expect(soldout.totalPages).toBe(1);
        expect((await run({ ...input, keyword: null })).itemList[0].item.id).toBe(newest.id);
        expect(await run(input)).toEqual(first);
        expect(await snapshotCreated()).toEqual(before);
    });

    it("D02: JSON例の公開列・関連あり/欠落null・nullable列・20件一致なら1ページ", async () => {
        const { owner } = await seed();
        const video = await Video.create({ title: null, summary: "非公開の概要" });
        const sale = await Sale.create({ before_price: 2000, sale_flag: true, discount_rate: 0, discount_amount: 1000 });
        for (let i = 0; i < 19; i++) await createItem({ seller_id: owner.id });
        const row = await createItem({
            seller_id: owner.id, name: "商品名", price: 1000, video_id: video.id, sale_id: sale.id,
            first_image_url: null, gender_type: "unisex", age_type: "both", status: "active",
        });
        const result = await run({ userId: owner.id, page: 1, status: undefined, keyword: null });
        expect(result.itemList).toHaveLength(20);
        expect(result.totalPages).toBe(1);
        expect(JSON.parse(JSON.stringify(result.itemList[0]))).toEqual({ item: {
            id: row.id, name: "商品名", price: 1000, status: "active", first_image_url: null,
            gender_type: "unisex", age_type: "both", uploaded_at: "2026-11-06T00:00:00.000Z",
            Video: { title: null }, Sale: { before_price: 2000, sale_flag: true, discount_rate: 0, discount_amount: 1000 },
        } });
        expect(JSON.parse(JSON.stringify(result.itemList[1]))).toEqual({ item: {
            id: result.itemList[1].item.id, name: null, price: null, status: "active", first_image_url: null,
            gender_type: "unisex", age_type: "both", uploaded_at: "2026-11-06T00:00:00.000Z", Video: null, Sale: null,
        } });
        expect(await run({ userId: owner.id, page: 2, status: undefined, keyword: null })).toEqual({ itemList: [], totalPages: 1 });
    });

    it.each(["%", "_", "\\", "*", ".", "[x]", "(x)", "^", "$", "+", "?", "{x}"])(
        "D03: 検索語%sをワイルドカードにせずsearch_textの文字として検索", async (keyword) => {
            const { owner } = await seed();
            const match = await createItem({ seller_id: owner.id, search_text: "a" + keyword + "b" });
            await createItem({ seller_id: owner.id, search_text: "aXb" });
            const result = await run({ userId: owner.id, page: 1, status: undefined, keyword });
            expect(result.itemList.map((r) => r.item.id)).toEqual([match.id]);
            expect(result.totalPages).toBe(1);
        },
    );

    it("D04: service直接呼出しでもwhereのseller_id偽装は本人条件を上書きしない", async () => {
        const { owner, other } = await seed();
        await createItem({ seller_id: owner.id });
        await createItem({ seller_id: other.id });
        const before = await snapshotCreated();
        await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true }, async (transaction) => {
            await queries.setUploadedItemListReadOnly({ transaction });
            const params = { userId: owner.id, where: { seller_id: other.id }, transaction };
            expect(await queries.getMyUploadedItemList({ ...params, limit: 20, offset: 0 })).toEqual([]);
            expect(await queries.countMyUploadedItemList(params)).toBe(0);
        });
        expect(await snapshotCreated()).toEqual(before);
    });

    it("D05: 一覧後の別接続削除commitをcountへ反映せず、次要求は最新のsnapshot", async () => {
        const { owner } = await seed();
        const row = await createItem({ seller_id: owner.id });
        const reached = deferred<undefined>();
        const release = deferred<undefined>();
        const original = queries.getMyUploadedItemList;
        vi.spyOn(queries, "getMyUploadedItemList").mockImplementationOnce(async (params) => {
            const rows = await original(params);
            const [actual] = await sequelize.query<{ isolation: string; readonly: string; pid: number }>(
                "SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS readonly, pg_backend_pid() AS pid",
                { transaction: params.transaction, type: QueryTypes.SELECT },
            );
            expect(actual.isolation).toBe("repeatable read");
            expect(actual.readonly).toBe("on");
            const [separate] = await observer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", { type: QueryTypes.SELECT });
            expect(separate.pid).not.toBe(actual.pid);
            reached.resolve(undefined);
            await release.promise;
            return rows;
        });
        const input = { userId: owner.id, page: 1, status: undefined, keyword: null };
        const pending = run(input);
        try {
            await Promise.race([reached.promise, pending.then(() => { throw new Error("gate not reached"); })]);
            await observer.query("DELETE FROM item WHERE id=:id", { replacements: { id: row.id } });
        } finally {
            release.resolve(undefined);
            await pending;
        }
        const result = await pending;
        expect(result.itemList.map((r) => r.item.id)).toEqual([row.id]);
        expect(result.totalPages).toBe(1);
        expect(await run(input)).toEqual({ itemList: [], totalPages: 0 });
    });

    it("D06: READ ONLYが実UPDATEを拒否、count未実行・全自作行不変・再試行成功", async () => {
        const { owner, other } = await seed();
        const row = await createItem({ seller_id: owner.id, name: "維持する商品" });
        await createItem({ seller_id: other.id, name: "他人の商品" });
        const before = await snapshotCreated();
        vi.spyOn(queries, "getMyUploadedItemList").mockImplementationOnce(async ({ transaction }) => {
            await sequelize.query("UPDATE item SET name=:name WHERE id=:id", {
                replacements: { name: "変更しない", id: row.id }, transaction,
            });
            throw new Error("READ ONLY did not reject UPDATE");
        });
        const count = vi.spyOn(queries, "countMyUploadedItemList");
        const input = { userId: owner.id, page: 1, status: undefined, keyword: null };
        await expect(run(input)).rejects.toMatchObject({ original: { code: "25006" } });
        expect(count).not.toHaveBeenCalled();
        expect(await snapshotCreated()).toEqual(before);
        expect((await run(input)).itemList.map((r) => r.item.id)).toEqual([row.id]);
        expect(await snapshotCreated()).toEqual(before);
        expect(await Item.count({ where: { seller_id: owner.id } })).toBe(1);
    });
});
