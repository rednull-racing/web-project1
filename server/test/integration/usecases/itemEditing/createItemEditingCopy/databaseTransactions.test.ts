import "../../../../fixtures/itemEditing/createItemEditingCopy/databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DatabaseError } from "sequelize";
import * as command from "../../../../../src/services/itemEditing/command.js";
import {
    seed,
    run,
    snapshot,
    editingIds,
    protectedSnapshot,
    expectCopy,
    expectedCopy,
    expectUnlocked,
    observer,
    Item,
    ItemEditing,
} from "../../../../fixtures/itemEditing/createItemEditingCopy/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemEditing/createItemEditingCopy/databaseFixtures.js";
import { deferred } from "../../../../fixtures/itemEditing/createItemEditingCopy/fixtures.js";

let f: DbFixture;
beforeEach(async () => {
    f = await seed();
});

describe("P0 実INSERT・commit・rollbackと再試行", () => {
    it("T02 T01: 実INSERTはtransaction内だけで可視、commit後に別接続から見える", async () => {
        const real = command.createItemEditingCopy;
        const inserted = deferred<number>(),
            release = deferred<void>();
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        vi.spyOn(command, "createItemEditingCopy").mockImplementation(async (params) => {
            const result = await real(params);
            expect(await ItemEditing.findByPk(result.id, { transaction: params.transaction })).not.toBeNull();
            inserted.resolve(result.id);
            await release.promise;
            return result;
        });
        let done = false;
        const pending = run(f).finally(() => {
            done = true;
        });
        const settled = Promise.allSettled([pending]);
        try {
            const id = await Promise.race([
                inserted.promise,
                pending.then(() => {
                    throw new Error("INSERT保留前に終了");
                }),
            ]);
            expect(await snapshot("item_editing", id)).toBeNull();
            expect(await editingIds(f)).toEqual(ids);
            expect(done).toBe(false);
        } finally {
            release.resolve();
            await settled;
        }
        const id = await pending;
        await expectCopy(id, expectedCopy(f));
        expect(await protectedSnapshot(f)).toEqual(before);
    });
    it.each(["ロックSELECT", "関連再取得", "作成前"] as const)(
        "T03 E05 E06 E07: %sの注入障害で書込みなし・ロック解放・再試行可能",
        async (step) => {
            const error = new Error(step);
            const before = await protectedSnapshot(f),
                ids = await editingIds(f);
            const create = vi.spyOn(command, "createItemEditingCopy");
            let reads = 0;
            Item.addHook("beforeFind", "copyReadFailure", () => {
                reads++;
                if ((step === "ロックSELECT" && reads === 1) || (step === "関連再取得" && reads === 2)) throw error;
            });
            if (step === "作成前") create.mockRejectedValueOnce(error);
            try {
                await expect(run(f)).rejects.toBe(error);
                if (step !== "作成前") expect(create).not.toHaveBeenCalled();
                expect(reads).toBe(step === "ロックSELECT" ? 1 : 2);
                expect(await editingIds(f)).toEqual(ids);
                expect(await protectedSnapshot(f)).toEqual(before);
                await expectUnlocked(f.item.id);
            } finally {
                Item.removeHook("beforeFind", "copyReadFailure");
                create.mockRestore();
            }
            await expectCopy(await run(f), expectedCopy(f));
        },
    );
    it("T04 T05: 実INSERT後の例外で部分行がrollbackされ同じ商品から再試行できる", async () => {
        const real = command.createItemEditingCopy,
            error = new Error("after insert");
        let insertedId: number | undefined;
        const before = await protectedSnapshot(f),
            ids = await editingIds(f);
        const spy = vi.spyOn(command, "createItemEditingCopy").mockImplementationOnce(async (params) => {
            const row = await real(params);
            insertedId = row.id;
            expect(await ItemEditing.findByPk(row.id, { transaction: params.transaction })).not.toBeNull();
            throw error;
        });
        await expect(run(f)).rejects.toBe(error);
        expect(insertedId).toBeTypeOf("number");
        expect(await snapshot("item_editing", insertedId!)).toBeNull();
        expect(await editingIds(f)).toEqual(ids);
        expect(await protectedSnapshot(f)).toEqual(before);
        await expectUnlocked(f.item.id);
        spy.mockRestore();
        const successId = await run(f);
        expect(successId).not.toBe(insertedId);
        await expectCopy(successId, expectedCopy(f));
        expect(await editingIds(f)).toEqual([...ids, successId].sort((a, b) => a - b));
    });
    it.each(["commit", "rollback"] as const)("T06: 実INSERT保留中は行ロックを保持し%s後に解放する", async (outcome) => {
        const real = command.createItemEditingCopy,
            error = new Error("rollback requested");
        const entered = deferred<void>(),
            release = deferred<void>();
        vi.spyOn(command, "createItemEditingCopy").mockImplementationOnce(async (params) => {
            const row = await real(params);
            entered.resolve();
            await release.promise;
            if (outcome === "rollback") throw error;
            return row;
        });
        const pending = run(f);
        const assertion =
            outcome === "rollback"
                ? expect(pending).rejects.toBe(error)
                : expect(pending).resolves.toBeTypeOf("number");
        const settled = Promise.allSettled([pending]);
        try {
            await Promise.race([
                entered.promise,
                pending.then(() => {
                    throw new Error("保留前に終了");
                }),
            ]);
            const lockError: unknown = await observer
                .transaction(async (transaction) => {
                    await observer.query("SELECT id FROM item WHERE id = :id FOR UPDATE NOWAIT", {
                        replacements: { id: f.item.id },
                        transaction,
                    });
                })
                .catch((caught: unknown) => caught);
            expect(lockError).toBeInstanceOf(DatabaseError);
            expect(lockError).toHaveProperty("parent.code", "55P03");
        } finally {
            release.resolve();
            await settled;
            await assertion;
        }
        await expectUnlocked(f.item.id);
    });
});
