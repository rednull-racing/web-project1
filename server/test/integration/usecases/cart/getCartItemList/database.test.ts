import "../../../../fixtures/cart/getCartItemList/databaseSetup.js";
import { describe, expect, it, vi } from "vitest";
import { Op, QueryTypes, Transaction } from "sequelize";
import {
    seed,
    Cart,
    Item,
    Video,
    Sale,
    observer,
    deferred,
    sequelize,
    createItem,
    createCart,
    snapshotCreated,
} from "../../../../fixtures/cart/getCartItemList/databaseFixtures.js";
import { getCartItemListUseCase as run } from "../../../../../src/usecases/cart/getCartItemList.js";
import * as queries from "../../../../../src/services/cart/query.js";

describe("P0 実DBのカート一覧・本人限定・snapshot", () => {
    it("D01: 出品者を限定せず本人のカートを検索・status・ページングし、再送でもDB不変", async () => {
        const { owner, other } = await seed();
        const rows = [];
        for (let i = 0; i < 21; i++) {
            const row = await createItem({
                seller_id: i % 3 === 0 ? null : i % 3 === 1 ? other.id : owner.id,
                name: "検索しない商品名",
                search_text: "aしゃつ",
                status: i % 2 ? "soldout" : "active",
            });
            rows.push(row);
            await createCart({ user_id: owner.id, item_id: row.id });
        }
        const different = await createItem({ seller_id: other.id, search_text: "別の検索語" });
        await createCart({ user_id: owner.id, item_id: different.id });
        const otherCartItem = await createItem({ seller_id: owner.id, search_text: "aしゃつ" });
        await createCart({ user_id: other.id, item_id: otherCartItem.id });
        await createCart({ user_id: other.id, item_id: rows[0].id });
        await createItem({ seller_id: other.id, search_text: "aしゃつ" });
        const nullText = await createItem({ seller_id: other.id, name: "aしゃつ", search_text: null });
        await createCart({ user_id: owner.id, item_id: nullText.id });
        const before = await snapshotCreated();
        const input = { userId: owner.id, page: 1, status: undefined, keyword: "Ａ シャツ" };
        const first = await run(input);
        const ids = rows
            .slice()
            .reverse()
            .map((row) => row.id);
        expect(first.totalPages).toBe(2);
        expect(first.itemList.map((row) => row.item.id)).toEqual(ids.slice(0, 20));
        expect((await run({ ...input, page: 2 })).itemList.map((row) => row.item.id)).toEqual([rows[0].id]);
        expect(await run({ ...input, page: 3 })).toEqual({ itemList: [], totalPages: 2 });
        expect(await run({ ...input, keyword: "不一致" })).toEqual({ itemList: [], totalPages: 0 });
        for (const status of ["active", "soldout"] as const) {
            const result = await run({ ...input, status });
            expect(result.itemList.map((row) => row.item.id)).toEqual(
                rows
                    .filter((row) => row.status === status)
                    .reverse()
                    .map((row) => row.id),
            );
            expect(result.totalPages).toBe(1);
        }
        expect(await run(input)).toEqual(first);
        expect(await snapshotCreated()).toEqual(before);
    });

    it("D02: 公開列だけを返し関連欠落・nullableを保持、20件一致なら1ページ", async () => {
        const { owner, other } = await seed();
        const video = await Video.create({ title: null, summary: "非公開の概要" });
        const sale = await Sale.create({
            before_price: 2000,
            sale_flag: true,
            discount_rate: 0,
            discount_amount: 1000,
        });
        for (let i = 0; i < 19; i++) {
            const row = await createItem({ seller_id: other.id });
            await createCart({ user_id: owner.id, item_id: row.id });
        }
        const row = await createItem({
            seller_id: other.id,
            name: "商品名",
            price: 1000,
            video_id: video.id,
            sale_id: sale.id,
            first_image_url: null,
            gender_type: "unisex",
            age_type: "both",
            status: "active",
        });
        await createCart({ user_id: owner.id, item_id: row.id });
        const before = await snapshotCreated();
        const result = await run({ userId: owner.id, page: 1, status: undefined, keyword: null });
        expect(result.itemList).toHaveLength(20);
        expect(result.totalPages).toBe(1);
        expect(result.itemList[0]).toEqual({
            item: {
                id: row.id,
                name: "商品名",
                price: 1000,
                status: "active",
                first_image_url: null,
                gender_type: "unisex",
                age_type: "both",
                Video: { title: null },
                Sale: { before_price: 2000, sale_flag: true, discount_rate: 0, discount_amount: 1000 },
            },
        });
        expect(result.itemList[1]).toEqual({
            item: {
                id: result.itemList[1].item.id,
                name: null,
                price: null,
                status: "active",
                first_image_url: null,
                gender_type: "unisex",
                age_type: "both",
                Video: null,
                Sale: null,
            },
        });
        expect(await run({ userId: owner.id, page: 2, status: undefined, keyword: null })).toEqual({
            itemList: [],
            totalPages: 1,
        });
        expect(await snapshotCreated()).toEqual(before);
    });

    it.each([
        ["%", "%"],
        ["_", "_"],
        ["\\", "\\"],
        ["*", "*"],
        ["\\*", "\\*"],
        [".", "."],
        ["[x]", "[x]"],
        ["(x)", "(x)"],
        ["^", "^"],
        ["$", "$"],
        ["+", "+"],
        ["?", "?"],
        ["{x}", "{x}"],
        ["％", "%"],
        ["＿", "_"],
        ["＼", "\\"],
    ])("D03: %sはsearch_textの通常文字として照合する", async (keyword, literal) => {
        const { owner, other } = await seed();
        const match = await createItem({ seller_id: other.id, search_text: "a" + literal + "b" });
        const mismatch = await createItem({ seller_id: other.id, search_text: "aXb" });
        await createCart({ user_id: owner.id, item_id: match.id });
        await createCart({ user_id: owner.id, item_id: mismatch.id });
        const before = await snapshotCreated();
        const result = await run({ userId: owner.id, page: 1, status: undefined, keyword });
        expect(result.itemList.map((row) => row.item.id)).toEqual([match.id]);
        expect(result.totalPages).toBe(1);
        expect(await snapshotCreated()).toEqual(before);
    });

    it("D04: service直接呼出しでもItem条件と本人カート条件を別々に適用する", async () => {
        const { owner, other } = await seed();
        const ownSale = await createItem({ seller_id: owner.id });
        const otherSale = await createItem({ seller_id: other.id });
        await createCart({ user_id: other.id, item_id: ownSale.id });
        await createCart({ user_id: owner.id, item_id: otherSale.id });
        const before = await snapshotCreated();
        await sequelize.transaction(
            { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true },
            async (transaction) => {
                await queries.setCartItemListReadOnly({ transaction });
                const params = { userId: owner.id, where: { seller_id: owner.id }, transaction };
                expect(await queries.getMyCartItemList({ ...params, limit: 20, offset: 0 })).toEqual([]);
                expect(await queries.countMyCartItemList(params)).toBe(0);
                const allowed = { ...params, where: { seller_id: other.id } };
                expect(
                    (await queries.getMyCartItemList({ ...allowed, limit: 20, offset: 0 })).map((row) => row.Item.id),
                ).toEqual([otherSale.id]);
                expect(await queries.countMyCartItemList(allowed)).toBe(1);
            },
        );
        expect(await snapshotCreated()).toEqual(before);
    });

    it("D05: 一覧後の別接続カート削除commitを件数に反映せず、次要求は最新snapshot", async () => {
        const { owner, other } = await seed();
        const row = await createItem({ seller_id: other.id });
        const cart = await createCart({ user_id: owner.id, item_id: row.id });
        const reached = deferred<undefined>();
        const release = deferred<undefined>();
        const original = queries.getMyCartItemList;
        vi.spyOn(queries, "getMyCartItemList").mockImplementationOnce(async (params) => {
            const rows = await original(params);
            const [actual] = await sequelize.query<{ isolation: string; readonly: string; pid: number }>(
                "SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS readonly, pg_backend_pid() AS pid",
                { transaction: params.transaction, type: QueryTypes.SELECT },
            );
            expect(actual.isolation).toBe("repeatable read");
            expect(actual.readonly).toBe("on");
            const [separate] = await observer.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
                type: QueryTypes.SELECT,
            });
            expect(separate.pid).not.toBe(actual.pid);
            reached.resolve(undefined);
            await release.promise;
            return rows;
        });
        const input = { userId: owner.id, page: 1, status: undefined, keyword: null };
        const pending = run(input);
        const collected = pending.then(
            (value) => ({ value }),
            (error: unknown) => ({ error }),
        );
        try {
            await Promise.race([
                reached.promise,
                pending.then(() => {
                    throw new Error("gate not reached");
                }),
            ]);
            await observer.query("DELETE FROM cart WHERE id=:id", { replacements: { id: cart.id } });
        } finally {
            release.resolve(undefined);
            await collected;
        }
        const result = await pending;
        expect(result.itemList.map((entry) => entry.item.id)).toEqual([row.id]);
        expect(result.totalPages).toBe(1);
        expect(await run(input)).toEqual({ itemList: [], totalPages: 0 });
        expect(await Item.count({ where: { id: row.id } })).toBe(1);
    });

    it("D06: READ ONLYが実UPDATEを拒否し件数未実行・自作行不変・再試行成功", async () => {
        const { owner, other } = await seed();
        const row = await createItem({ seller_id: other.id, name: "維持する商品" });
        await createCart({ user_id: owner.id, item_id: row.id });
        await createCart({ user_id: other.id, item_id: row.id });
        const before = await snapshotCreated();
        vi.spyOn(queries, "getMyCartItemList").mockImplementationOnce(async ({ transaction }) => {
            await sequelize.query("UPDATE item SET name=:name WHERE id=:id", {
                replacements: { name: "変更しない", id: row.id },
                transaction,
            });
            throw new Error("READ ONLY did not reject UPDATE");
        });
        const count = vi.spyOn(queries, "countMyCartItemList");
        const input = { userId: owner.id, page: 1, status: undefined, keyword: null };
        await expect(run(input)).rejects.toMatchObject({ original: { code: "25006" } });
        expect(count).not.toHaveBeenCalled();
        expect(await snapshotCreated()).toEqual(before);
        expect((await run(input)).itemList.map((entry) => entry.item.id)).toEqual([row.id]);
        expect(await snapshotCreated()).toEqual(before);
        expect(await Cart.count({ where: { user_id: { [Op.in]: [owner.id, other.id] } } })).toBe(2);
    });

    it("D07: カートのcreatedAt DESC・ID DESCで並び、updatedAtと商品順の影響を受けない", async () => {
        const { owner, other } = await seed();
        const first = await createItem({ seller_id: other.id, uploaded_at: new Date("2026-11-28T00:00:00Z") });
        const second = await createItem({ seller_id: other.id, uploaded_at: new Date("2026-11-30T00:00:00Z") });
        const third = await createItem({ seller_id: other.id, uploaded_at: new Date("2026-11-28T00:00:00Z") });
        await createCart({
            user_id: owner.id,
            item_id: first.id,
            createdAt: new Date("2026-11-11T00:00:00Z"),
            updatedAt: new Date("2026-11-11T00:00:00Z"),
        });
        await createCart({ user_id: owner.id, item_id: third.id, updatedAt: new Date("2026-11-29T00:00:00Z") });
        await createCart({ user_id: owner.id, item_id: second.id });
        const before = await snapshotCreated();
        const result = await run({ userId: owner.id, page: 1, status: undefined, keyword: null });
        expect(result.itemList.map((entry) => entry.item.id)).toEqual([first.id, second.id, third.id]);
        expect(result.totalPages).toBe(1);
        expect(await snapshotCreated()).toEqual(before);
    });
});
