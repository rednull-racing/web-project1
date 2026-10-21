import "../../../../fixtures/itemEditing/cronDeleteItemEditing/databaseSetup.js";
import { QueryTypes } from "sequelize";
import { describe, expect, it, vi } from "vitest";
import {
    sequelize,
    ItemEditing,
    ItemDraft,
    Item,
    command,
    seed,
    snapshot,
    run,
    waitForBlocked,
} from "../../../../fixtures/itemEditing/cronDeleteItemEditing/databaseFixtures.js";
import { deferred } from "../../../../fixtures/items/createItem/fixtures.js";

describe("P0/P1: 実DBの期限削除とtransaction", () => {
    it("D01: 期限直前/一致のみ削除、更新日時・null所有者は除外条件にしない、再実行0件", async () => {
        const rows = await seed();
        const keep = rows.slice(2).map((row) => row.id);
        const before = await snapshot(keep);
        const draft = await ItemDraft.create({ name: "保持する下書き", createdAt: new Date("1800-01-01") });
        const item = await Item.create({
            name: "保持する商品",
            uploaded_at: new Date("1800-01-01"),
            createdAt: new Date("1800-01-01"),
        });
        const draftBefore = draft.toJSON(),
            itemBefore = item.toJSON();
        expect(await run()).toBe(2);
        expect(await snapshot(rows.slice(0, 2).map((row) => row.id))).toEqual([]);
        expect(await snapshot(keep)).toEqual(before);
        expect((await draft.reload()).toJSON()).toEqual(draftBefore);
        expect((await item.reload()).toJSON()).toEqual(itemBefore);
        expect(await run()).toBe(0);
    });
    it("D02: DELETE後の失敗で全行を復元し再試行できる", async () => {
        const rows = await seed(),
            ids = rows.map((row) => row.id);
        const before = await snapshot(ids);
        const actual = command.destroyExpiredItemEditings;
        const failure = new Error("after real delete");
        const spy = vi.spyOn(command, "destroyExpiredItemEditings").mockImplementationOnce(async (params) => {
            expect(await actual(params)).toBe(2);
            expect(await snapshot(ids.slice(0, 2), params.transaction)).toEqual([]);
            throw failure;
        });
        await expect(run()).rejects.toBe(failure);
        expect(await snapshot(ids)).toEqual(before);
        spy.mockRestore();
        expect(await run()).toBe(2);
    });
    it("D03: 別connectionではcommit前に旧行、完了後に削除を観測する", async () => {
        const rows = await seed(),
            ids = rows.map((row) => row.id);
        const before = await snapshot(ids);
        const actual = command.destroyExpiredItemEditings;
        const entered = deferred<void>(),
            release = deferred<void>();
        vi.spyOn(command, "destroyExpiredItemEditings").mockImplementationOnce(async (params) => {
            const count = await actual(params);
            entered.resolve();
            await release.promise;
            return count;
        });
        const pending = run();
        const checked = expect(pending).resolves.toBe(2);
        try {
            await Promise.race([
                entered.promise,
                pending.then(() => {
                    throw new Error("early return");
                }),
            ]);
            expect(await snapshot(ids)).toEqual(before);
        } finally {
            release.resolve();
            await checked;
        }
        expect(await snapshot(ids.slice(0, 2))).toEqual([]);
    });
    it.each(["commit", "rollback"] as const)(
        "D04: 先行削除の%sまで実ロック待機し残存行だけ削除",
        async (completion) => {
            const rows = await seed(),
                ids = rows.map((row) => row.id);
            const transaction = await sequelize.transaction();
            let pending: Promise<number> | undefined;
            let outcome: Promise<{ count: number } | { error: unknown }> | undefined;
            let completed = false;
            try {
                const [isolation] = await sequelize.query<{ transaction_isolation: string }>(
                    "SHOW transaction_isolation",
                    { transaction, type: QueryTypes.SELECT },
                );
                expect(isolation.transaction_isolation).toBe("read committed");
                const [pid] = await sequelize.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
                    transaction,
                    type: QueryTypes.SELECT,
                });
                await ItemEditing.destroy({ where: { id: ids[0] }, transaction });
                pending = run();
                outcome = pending.then(
                    (count) => ({ count }),
                    (error: unknown) => ({ error }),
                );
                await Promise.race([
                    waitForBlocked(pid.pid),
                    pending.then(() => {
                        throw new Error("no lock wait");
                    }),
                ]);
                if (completion === "commit") await transaction.commit();
                else await transaction.rollback();
                completed = true;
                expect(await outcome).toEqual({ count: completion === "commit" ? 1 : 2 });
                expect(await snapshot(ids.slice(0, 2))).toEqual([]);
                expect((await snapshot(ids.slice(2))).map((row) => row.id)).toEqual(ids.slice(2));
            } finally {
                if (!completed) await transaction.rollback();
                if (outcome) await outcome;
            }
        },
    );
});

describe("P0: マイグレーション後の実DB日時制約", () => {
    it.each(["createdAt", "updatedAt"] as const)("D05: item.%sはSQLでもNULLを拒否する", async (column) => {
        const item = await Item.create({ name: "制約確認", uploaded_at: new Date("2020-01-01T00:00:00Z") });
        const before = item.toJSON();
        await expect(
            sequelize.transaction(async (transaction) => {
                // columnは上の固定許可リストだけ。値はbindする。
                await sequelize.query(`UPDATE item SET "${column}"=NULL WHERE id=$id`, {
                    bind: { id: item.id },
                    transaction,
                });
            }),
        ).rejects.toMatchObject({ original: { code: "23502", column } });
        expect((await item.reload()).toJSON()).toEqual(before);
    });
});
