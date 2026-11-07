import "../../../../fixtures/itemDraft/getItemDraftList/databaseSetup.js";
import { describe, expect, it, vi } from "vitest";
import { QueryTypes } from "sequelize";
import {
    seed,
    ItemDraft,
    observer,
    deferred,
    sequelize,
    snapshotCreatedDrafts,
} from "../../../../fixtures/itemDraft/getItemDraftList/databaseFixtures.js";
import { getItemDraftListUseCase as run } from "../../../../../src/usecases/itemDraft/getItemDraftList.js";
import * as queries from "../../../../../src/services/itemDraft/query.js";

describe("P0 実DBの本人限定・ページ・snapshot", () => {
    it("D01: 本人のname/title OR、null列、降順、0/20/21件・範囲外・再送", async () => {
        const { owner, other } = await seed();
        const rows = [];
        for (let i = 0; i < 21; i++)
            rows.push(
                await ItemDraft.create({
                    seller_id: owner.id,
                    name: i % 2 ? "aしゃつ" : null,
                    title: i % 2 ? null : "aしゃつ",
                    createdAt: new Date("2026-11-06T00:00:00Z"),
                }),
            );
        const newest = await ItemDraft.create({
            seller_id: owner.id,
            name: "別商品",
            createdAt: new Date("2026-11-07T00:00:00Z"),
        });
        await ItemDraft.create({ seller_id: other.id, name: "aしゃつ" });
        await ItemDraft.create({ seller_id: null, name: "aしゃつ" });
        const before = await snapshotCreatedDrafts();
        const input = { userId: owner.id, page: 1, keyword: "Ａ シャツ" };
        const first = await run(input);
        expect(first.totalPages).toBe(2);
        expect(first.itemDraftList.map((r) => r.itemDraft.id)).toEqual(
            rows
                .slice(1)
                .reverse()
                .map((r) => r.id),
        );
        expect(Object.keys(JSON.parse(JSON.stringify(first.itemDraftList[0].itemDraft))).sort()).toEqual([
            "createdAt",
            "first_image_url",
            "id",
            "name",
            "price",
            "title",
        ]);
        expect(first.itemDraftList[0].itemDraft.price).toBeNull();
        expect((await run({ ...input, page: 2 })).itemDraftList.map((r) => r.itemDraft.id)).toEqual([rows[0].id]);
        expect(await run({ ...input, page: 3 })).toEqual({ itemDraftList: [], totalPages: 2 });
        expect(await run({ ...input, keyword: "不一致" })).toEqual({ itemDraftList: [], totalPages: 0 });
        expect((await run({ ...input, keyword: null })).itemDraftList[0].itemDraft.id).toBe(newest.id);
        expect((await run(input)).itemDraftList.map((r) => r.itemDraft.id)).toEqual(
            first.itemDraftList.map((r) => r.itemDraft.id),
        );
        expect(await ItemDraft.count({ where: { seller_id: owner.id } })).toBe(22);
        expect(await snapshotCreatedDrafts()).toEqual(before);
    });
    it.each(["%", "_", "\\", "*", ".", "[x]", "(x)", "^", "$", "+", "?", "{x}"])(
        "D01: 検索語%sをワイルドカードにせず文字一致",
        async (keyword) => {
            const { owner } = await seed();
            const match = await ItemDraft.create({ seller_id: owner.id, name: "a" + keyword + "b" });
            await ItemDraft.create({ seller_id: owner.id, name: "aXb" });
            const result = await run({ userId: owner.id, page: 1, keyword });
            expect(result.itemDraftList.map((r) => r.itemDraft.id)).toEqual([match.id]);
            expect(result.totalPages).toBe(1);
        },
    );
    it("D01: 20件一致なら1ページ、全null列もそのまま返す", async () => {
        const { owner } = await seed();
        for (let i = 0; i < 20; i++) await ItemDraft.create({ seller_id: owner.id });
        const result = await run({ userId: owner.id, page: 1, keyword: null });
        expect(result.itemDraftList).toHaveLength(20);
        expect(result.totalPages).toBe(1);
        expect(result.itemDraftList[0].itemDraft.name).toBeNull();
        expect(result.itemDraftList[0].itemDraft.title).toBeNull();
        expect(await run({ userId: owner.id, page: 2, keyword: null })).toEqual({ itemDraftList: [], totalPages: 1 });
    });
    it("D02: 一覧後に別接続が削除commitしてもcountは同snapshot、次要求は最新", async () => {
        const { owner } = await seed();
        const row = await ItemDraft.create({ seller_id: owner.id, name: "snapshot" });
        const reached = deferred<undefined>();
        const release = deferred<undefined>();
        const original = queries.getMyItemDraftList;
        vi.spyOn(queries, "getMyItemDraftList").mockImplementationOnce(async (params) => {
            const rows = await original(params);
            const [settings] = await observer.query<{ isolation: string }>(
                "SELECT current_setting('transaction_isolation') AS isolation",
                { type: QueryTypes.SELECT },
            );
            expect(settings.isolation).toBe("read committed");
            const [actual] = await sequelize.query<{ isolation: string; readonly: string }>(
                "SELECT current_setting('transaction_isolation') AS isolation, current_setting('transaction_read_only') AS readonly",
                { transaction: params.transaction, type: QueryTypes.SELECT },
            );
            expect(actual).toEqual({ isolation: "repeatable read", readonly: "on" });
            reached.resolve(undefined);
            await release.promise;
            return rows;
        });
        const input = { userId: owner.id, page: 1, keyword: null };
        const pending = run(input);
        try {
            await Promise.race([
                reached.promise,
                pending.then(() => {
                    throw new Error("gate not reached");
                }),
            ]);
            await observer.query("DELETE FROM item_draft WHERE id=:id", { replacements: { id: row.id } });
        } finally {
            release.resolve(undefined);
            await pending;
        }
        const result = await pending;
        expect(result.itemDraftList.map((r) => r.itemDraft.id)).toEqual([row.id]);
        expect(result.totalPages).toBe(1);
        expect(await run(input)).toEqual({ itemDraftList: [], totalPages: 0 });
    });
    it("D03: READ ONLYは実UPDATEを拒否し、自作行不変・再試行成功", async () => {
        const { owner, other } = await seed();
        const row = await ItemDraft.create({ seller_id: owner.id, name: "維持する商品" });
        await ItemDraft.create({ seller_id: other.id, name: "他人の商品" });
        const before = await snapshotCreatedDrafts();
        vi.spyOn(queries, "getMyItemDraftList").mockImplementationOnce(async ({ transaction }) => {
            await sequelize.query("UPDATE item_draft SET name=:name WHERE id=:id", {
                replacements: { name: "変更しない", id: row.id },
                transaction,
            });
            throw new Error("READ ONLY did not reject UPDATE");
        });
        const count = vi.spyOn(queries, "countMyItemDraftList");
        const input = { userId: owner.id, page: 1, keyword: null };
        await expect(run(input)).rejects.toMatchObject({ original: { code: "25006" } });
        expect(count).not.toHaveBeenCalled();
        expect(await snapshotCreatedDrafts()).toEqual(before);
        expect((await run(input)).itemDraftList.map((r) => r.itemDraft.id)).toEqual([row.id]);
        expect(await snapshotCreatedDrafts()).toEqual(before);
    });
});
