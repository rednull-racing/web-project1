import "../../../../fixtures/itemEditing/convertItemEditingVideo/databaseSetup.js";
import { performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import { describe, expect, it } from "vitest";
import {
    ItemEditing, observer, protectedSnapshot, seed, sequelize, snapshot,
} from "../../../../fixtures/itemEditing/convertItemEditingVideo/databaseFixtures.js";
import { getMyItemEditing } from "../../../../../src/services/itemEditing/query.js";
import { updateItemEditingVideo } from "../../../../../src/services/itemEditing/command.js";
import type { UpdateItemEditingVideoData } from "../../../../../src/types/serviceType/itemEditing.js";

// HTTP/schemaを通さず、所有者限定queryと更新serviceの実DB契約を検証する。
const persist = async (itemEditingId: number, userId: number, data: UpdateItemEditingVideoData) => {
    await sequelize.transaction(async (transaction) => {
        const itemEditing = await getMyItemEditing({ itemEditingId, userId, transaction });
        expect(itemEditing).not.toBeNull();
        if (!itemEditing) throw new Error("Fixture editing not found");
        await updateItemEditingVideo({ itemEditing, data, transaction });
    });
};
const withoutUpdatedAt = (row: Record<string, unknown> | null) => {
    if (!row) throw new Error("Expected persisted row");
    const { updatedAt, ...data } = row;
    expect(updatedAt).toBeInstanceOf(Date);
    return data;
};
const transactionPid = async (transaction: Transaction) => {
    await sequelize.query("SET LOCAL lock_timeout = '8000ms'", { transaction });
    const [row] = await sequelize.query<{ pid: number; isolation: string }>(
        "SELECT pg_backend_pid() AS pid, current_setting('transaction_isolation') AS isolation",
        { transaction, type: QueryTypes.SELECT },
    );
    expect(row.isolation).toBe("read committed");
    return row.pid;
};
const waitBlocked = async (waiter: number, blocker: number, pending: Promise<unknown>) => {
    let finished = false;
    const observed = pending.then(() => { finished = true; }, () => { finished = true; });
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
        if (finished) {
            await observed;
            throw new Error("ロック待機を観測する前に取得が終了しました");
        }
        const [row] = await observer.query<{ blocked: boolean; wait_event_type: string | null }>(
            "SELECT :blocker = ANY(pg_blocking_pids(:waiter)) AS blocked, wait_event_type FROM pg_stat_activity WHERE pid = :waiter",
            { replacements: { waiter, blocker }, type: QueryTypes.SELECT },
        );
        if (row?.blocked && row.wait_event_type === "Lock") return;
        await setImmediate();
    }
    throw new Error("指定PID間の実ロック待機を確認できませんでした");
};

describe("動画変換serviceの実DB永続化", () => {
    it.each(["original", "processing", "converted", "failed", null])("D01: 元状態%sからprocessingを保存し、URL・秒数と非対象情報を保持する", async (video_status) => {
        const fixture = await seed();
        await fixture.editing.update({ video_status });
        const before = await snapshot("item_editing", fixture.editing.id);
        const protectedBefore = await protectedSnapshot(fixture);
        await persist(fixture.editing.id, fixture.owner.id, { video_status: "processing" });
        expect(withoutUpdatedAt(await snapshot("item_editing", fixture.editing.id))).toEqual({
            ...withoutUpdatedAt(before), video_status: "processing",
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it.each([0, 42])("D02: 成功時converted・今回URL・秒数%sだけを保存する", async (duration) => {
        const fixture = await seed();
        await persist(fixture.editing.id, fixture.owner.id, { video_status: "processing" });
        const before = await snapshot("item_editing", fixture.editing.id);
        const protectedBefore = await protectedSnapshot(fixture);
        await persist(fixture.editing.id, fixture.owner.id, {
            video_status: "converted", converted_url: "https://media.test/new/index.m3u8", duration,
        });
        expect(withoutUpdatedAt(await snapshot("item_editing", fixture.editing.id))).toEqual({
            ...withoutUpdatedAt(before), video_status: "converted", converted_url: "https://media.test/new/index.m3u8", duration,
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it.each([17, null])("D03: 失敗時failed・URL nullを保存してduration=%sを保持する", async (duration) => {
        const fixture = await seed();
        await fixture.editing.update({ duration });
        const before = await snapshot("item_editing", fixture.editing.id);
        const protectedBefore = await protectedSnapshot(fixture);
        await persist(fixture.editing.id, fixture.owner.id, { video_status: "failed", converted_url: null });
        expect(withoutUpdatedAt(await snapshot("item_editing", fixture.editing.id))).toEqual({
            ...withoutUpdatedAt(before), video_status: "failed", converted_url: null,
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it("D04: 実更新後のcallback例外で全対象列がrollbackされる", async () => {
        const fixture = await seed();
        const before = await snapshot("item_editing", fixture.editing.id);
        const protectedBefore = await protectedSnapshot(fixture);
        const error = new Error("after video write");
        const task = sequelize.transaction(async (transaction) => {
            const itemEditing = await getMyItemEditing({ itemEditingId: fixture.editing.id, userId: fixture.owner.id, transaction });
            if (!itemEditing) throw new Error("Fixture not found");
            await updateItemEditingVideo({ itemEditing, data: { video_status: "converted", converted_url: "https://media.test/rolled-back.m3u8", duration: 99 }, transaction });
            expect((await snapshot("item_editing", fixture.editing.id, transaction))?.duration).toBe(99);
            expect(await snapshot("item_editing", fixture.editing.id)).toEqual(before);
            throw error;
        });
        await expect(task).rejects.toBe(error);
        expect(await snapshot("item_editing", fixture.editing.id)).toEqual(before);
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it("D05: 他人・所有者null・不存在を実検索で除外し全行を保持する", async () => {
        const fixture = await seed();
        const missing = await ItemEditing.create({ seller_id: fixture.owner.id });
        const missingId = missing.id;
        await missing.destroy();
        const before = await snapshot("item_editing", fixture.editing.id);
        const protectedBefore = await protectedSnapshot(fixture);
        for (const [itemEditingId, userId] of [
            [fixture.editing.id, fixture.other.id], [fixture.otherEditing.id, fixture.owner.id],
            [fixture.ownerlessEditing.id, fixture.owner.id], [missingId, fixture.owner.id],
        ]) {
            await sequelize.transaction(async (transaction) => {
                expect(await getMyItemEditing({ itemEditingId, userId, transaction })).toBeNull();
            });
        }
        expect(await snapshot("item_editing", fixture.editing.id)).toEqual(before);
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it("D06: UPDATEロックの実待機後、元URL差替えの確定値を後続取得が読む", async () => {
        const fixture = await seed();
        const protectedBefore = await protectedSnapshot(fixture);
        const first = await sequelize.transaction();
        let firstClosed = false;
        let second: Transaction | undefined;
        let secondClosed = false;
        let pending: Promise<Awaited<ReturnType<typeof getMyItemEditing>>> | undefined;
        let outcome: Promise<PromiseSettledResult<Awaited<ReturnType<typeof getMyItemEditing>>>> | undefined;
        try {
            second = await sequelize.transaction();
            const firstPid = await transactionPid(first);
            const secondPid = await transactionPid(second);
            const locked = await getMyItemEditing({ itemEditingId: fixture.editing.id, userId: fixture.owner.id, transaction: first });
            if (!locked) throw new Error("Fixture not found");
            pending = getMyItemEditing({ itemEditingId: fixture.editing.id, userId: fixture.owner.id, transaction: second });
            outcome = pending.then((value) => ({ status: "fulfilled", value }), (reason: unknown) => ({ status: "rejected", reason }));
            await waitBlocked(secondPid, firstPid, pending);
            await locked.update({ original_url: "https://media.test/replaced-source.mp4" }, { transaction: first });
            await first.commit();
            firstClosed = true;
            const result = await outcome;
            if (result.status === "rejected") throw result.reason;
            expect(result.value?.original_url).toBe("https://media.test/replaced-source.mp4");
            await second.commit();
            secondClosed = true;
        } finally {
            if (!firstClosed) await first.rollback();
            if (outcome) await outcome;
            if (second && !secondClosed) await second.rollback();
        }
        expect((await snapshot("item_editing", fixture.editing.id))?.original_url).toBe("https://media.test/replaced-source.mp4");
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    }, 20000);

    it("D07: duration整数範囲の実DBエラーが伝播し、同transactionの先行更新もrollbackする", async () => {
        const fixture = await seed();
        const before = await snapshot("item_editing", fixture.editing.id);
        const task = sequelize.transaction(async (transaction) => {
            const itemEditing = await getMyItemEditing({ itemEditingId: fixture.editing.id, userId: fixture.owner.id, transaction });
            if (!itemEditing) throw new Error("Fixture not found");
            await updateItemEditingVideo({ itemEditing, data: { video_status: "processing" }, transaction });
            expect((await snapshot("item_editing", fixture.editing.id, transaction))?.video_status).toBe("processing");
            await updateItemEditingVideo({ itemEditing, data: { video_status: "converted", converted_url: "https://media.test/overflow.m3u8", duration: 2147483648 }, transaction });
        });
        await expect(task).rejects.toMatchObject({ name: "SequelizeDatabaseError", original: { code: "22003" } });
        expect(await snapshot("item_editing", fixture.editing.id)).toEqual(before);
    });
});
