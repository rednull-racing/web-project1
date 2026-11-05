import { describe, expect, it } from "vitest";
import { seed, run, trashRows, snapshot, Item, protectedSnapshot, notification } from "../../../../fixtures/itemTrash/createItemTrash/databaseFixtures.js";
import { gateReads, waitForGate, waitBlocked } from "../../../../fixtures/itemTrash/createItemTrash/concurrencyFixtures.js";

describe("createItemTrash 実DBの行ロック・再評価", () => {
    it.each([false, true])("CC-01/02 先行rollback=%sで同一商品の実待機・再評価を検証", async (rollback) => {
        const f = await seed();
        const before = await protectedSnapshot(f);
        const slots = gateReads();
        let failOnce = rollback;
        Item.addHook("beforeDestroy", "trashConcurrentFailure", (item: InstanceType<typeof Item>) => {
            if (item.id === f.item.id && failOnce) { failOnce = false; throw new Error("先行削除の障害注入"); }
        });
        const first = run(f);
        const firstResult = first.then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
        let secondResult: Promise<unknown> | undefined;
        try {
            const firstState = await waitForGate(slots[0].started.promise, firstResult);
            await waitForGate(slots[0].entered.promise, firstResult);
            const second = run(f);
            secondResult = second.then(() => ({ ok: true as const }), (error: unknown) => ({ ok: false as const, error }));
            const secondState = await waitForGate(slots[1].started.promise, secondResult);
            await waitBlocked(secondState.pid, firstState.pid, secondResult);
            expect(await snapshot("item", f.item.id)).not.toBeNull();
            expect(await trashRows(f)).toEqual([]);
            expect(notification).not.toHaveBeenCalled();
            slots[0].release.resolve();
            if (rollback) {
                expect(await firstResult).toMatchObject({ ok: false, error: { message: "先行削除の障害注入" } });
                await waitForGate(slots[1].entered.promise, secondResult);
                expect(await snapshot("item", f.item.id)).not.toBeNull();
                expect(await trashRows(f)).toEqual([]);
                slots[1].release.resolve();
                expect(await secondResult).toEqual({ ok: true });
            } else {
                expect(await firstResult).toEqual({ ok: true });
                slots[1].release.resolve();
                expect(await secondResult).toMatchObject({ ok: false, error: { code: "ITEM_NOT_FOUND", statusCode: 404 } });
            }
            expect(await snapshot("item", f.item.id)).toBeNull();
            expect(await trashRows(f)).toHaveLength(1);
            expect(notification).toHaveBeenCalledTimes(1);
            expect(await protectedSnapshot(f)).toEqual(before);
        } finally {
            for (const slot of slots) slot.release.resolve();
            await Promise.allSettled([firstResult, ...(secondResult ? [secondResult] : [])]);
            Item.removeHook("beforeDestroy", "trashConcurrentFailure");
        }
    });
});
