import "../../../../fixtures/itemEditing/createItemEditingDraft/databaseSetup.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as query from "../../../../../src/services/itemDraft/query.js";
import * as editingCommand from "../../../../../src/services/itemEditing/command.js";
import * as draftCommand from "../../../../../src/services/itemDraft/command.js";
import {
    seed,
    run,
    snapshot,
    observer,
    competitor,
    sequelize,
    savedEditings,
    expectCopied,
    protectedRows,
} from "../../../../fixtures/itemEditing/createItemEditingDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemEditing/createItemEditingDraft/databaseFixtures.js";
import {
    deferred,
    expectAppError,
    waitForGate,
} from "../../../../../src/usecases/itemEditing/test/createItemEditingDraft.fixtures.js";

let f: DbFixture;
const sql: string[] = [];
beforeEach(async () => {
    f = await seed();
    sql.length = 0;
    for (const connection of [sequelize, competitor]) {
        const [row] = await connection.query<{ transaction_isolation: string }>("SHOW transaction_isolation", {
            type: QueryTypes.SELECT,
        });
        if (row.transaction_isolation !== "read committed")
            throw new Error("DB_TEST_STOP: concurrency contract requires READ COMMITTED");
    }
    sequelize.addHook("beforeQuery", "createItemEditingDraftSql", (_options, current) => {
        current.options.logging = (statement) => {
            if (statement.includes("FOR UPDATE")) sql.push(statement);
        };
    });
});
afterEach(() => {
    sequelize.removeHook("beforeQuery", "createItemEditingDraftSql");
});

const transactionPid = async (connection: typeof sequelize, transaction: Transaction) => {
    await connection.query("SET LOCAL lock_timeout = '5000ms'", { transaction });
    const [row] = await connection.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
        transaction,
        type: QueryTypes.SELECT,
    });
    return row.pid;
};
const gateReads = (
    observe?: (phase: "started" | "acquired", transaction: Transaction, pid: number, found?: boolean) => void,
) => {
    const slots = Array.from({ length: 2 }, () => ({
        started: deferred<{ pid: number; transaction: Transaction }>(),
        entered: deferred<void>(),
        release: deferred<void>(),
    }));
    const real = query.getMyItemDraft;
    let index = 0;
    vi.spyOn(query, "getMyItemDraft").mockImplementation(async (params) => {
        const slot = slots[index++];
        if (!slot) throw new Error("想定外の3回目の取得");
        const pid = await transactionPid(sequelize, params.transaction);
        observe?.("started", params.transaction, pid);
        slot.started.resolve({ pid, transaction: params.transaction });
        const row = await real(params);
        observe?.("acquired", params.transaction, pid, row !== null);
        slot.entered.resolve();
        await slot.release.promise;
        return row;
    });
    return slots;
};
const waitBlocked = async (waiter: number, blocker: number, pending: Promise<unknown>) => {
    // 待ち時間で順序を決めず、PostgreSQLが通知する実ブロッカーを期限付きで検査する。
    let finished = false;
    let failure: unknown;
    void pending.then(
        () => {
            finished = true;
        },
        (error: unknown) => {
            finished = true;
            failure = error;
        },
    );
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
        if (finished) throw failure ?? new Error("ロック待機確認前に処理が終了しました");
        const [row] = await observer.query<{ blocked: boolean }>(
            "SELECT :blocker = ANY(pg_blocking_pids(:waiter)) AS blocked",
            { replacements: { waiter, blocker }, type: QueryTypes.SELECT },
        );
        if (row.blocked) return;
        await setImmediate();
    }
    throw new Error("対象transactionの行ロック待機を確認できませんでした");
};
const expectLockSql = () => {
    const statements = sql.filter((line) => line.includes('FROM "item_draft"'));
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
        expect(statement).toContain("FOR UPDATE");
        expect(statement).toContain('"seller_id"');
    }
};
const changeDraft = (transaction: Transaction, mode: "更新" | "削除" | "所有者変更") => {
    const statement =
        mode === "削除"
            ? "DELETE FROM item_draft WHERE id=:id RETURNING id"
            : mode === "所有者変更"
              ? "UPDATE item_draft SET seller_id=:owner WHERE id=:id RETURNING id"
              : `UPDATE item_draft SET name=:name, price=:price, image_url=ARRAY[:image]::text[],
                 attributes=CAST(:attributes AS jsonb) WHERE id=:id RETURNING id`;
    return competitor.query<{ id: number }>(statement, {
        transaction,
        type: QueryTypes.SELECT,
        replacements: {
            id: f.draft.id,
            owner: f.other.id,
            name: "並行更新後",
            price: 1900,
            image: "https://media.test/updated",
            attributes: JSON.stringify({
                inventory: { initial: 9, current: 6, low_stock_ratio: 0.7 },
                materials: [{ name: "絹", ratio: 100 }],
            }),
        },
    });
};

describe("P0: 同じ下書きの重複作成を実ロックで防ぐ", () => {
    it.each(["A→B", "B→A"] as const)(
        "P01 AF-DB01 AF-DB03: %sで指定した先行要求だけ成功し後続404、非対象行は不変",
        async (order) => {
            const original = (await snapshot("item_draft", f.draft.id))!,
                protectedBefore = await protectedRows(f);
            type RequestName = "A" | "B";
            type ReadEvent = {
                name: RequestName;
                phase: "started" | "acquired";
                transaction: Transaction;
                pid: number;
                found?: boolean;
            };
            const context = new AsyncLocalStorage<RequestName>();
            const starts: RequestName[] = [],
                reads: ReadEvent[] = [],
                completions: RequestName[] = [];
            const results: Partial<Record<RequestName, PromiseSettledResult<number>>> = {};
            // 同じ入力でも非同期コンテキストで要求を識別し、取得順からA/Bを推測しない。
            const gates = gateReads((phase, transaction, pid, found) => {
                const name = context.getStore();
                if (!name) throw new Error("取得処理の要求コンテキストがありません");
                reads.push({ name, phase, transaction, pid, found });
            });
            const create = vi.spyOn(editingCommand, "createItemEditingDraft"),
                remove = vi.spyOn(draftCommand, "deleteItemDraft");
            const start = (name: RequestName) =>
                context.run(name, () => {
                    starts.push(name);
                    return run(f).then(
                        (value) => {
                            results[name] = { status: "fulfilled", value };
                            completions.push(name);
                            return value;
                        },
                        (reason: unknown) => {
                            results[name] = { status: "rejected", reason };
                            completions.push(name);
                            throw reason;
                        },
                    );
                });
            const calls = { A: () => start("A"), B: () => start("B") };
            const firstName = order === "A→B" ? "A" : "B",
                secondName = firstName === "A" ? "B" : "A";
            const first = calls[firstName](),
                settledFirst = Promise.allSettled([first]);
            let second: Promise<number> | undefined;
            let settledSecond: Promise<PromiseSettledResult<number>[]> | undefined;
            try {
                await waitForGate(gates[0].entered.promise, first);
                const a = await gates[0].started.promise;
                second = calls[secondName]();
                settledSecond = Promise.allSettled([second]);
                const b = await waitForGate(gates[1].started.promise, second);
                expect(b.pid).not.toBe(a.pid);
                await waitBlocked(b.pid, a.pid, second);
                expect(create).not.toHaveBeenCalled();
                expect(remove).not.toHaveBeenCalled();
                expect(starts).toEqual([firstName, secondName]);
                expect(reads.map(({ name, phase }) => ({ name, phase }))).toEqual([
                    { name: firstName, phase: "started" },
                    { name: firstName, phase: "acquired" },
                    { name: secondName, phase: "started" },
                ]);
                expect(completions).toEqual([]);
                gates[0].release.resolve();
                const id = await first;
                await waitForGate(gates[1].entered.promise, second);
                expect(completions).toEqual([firstName]);
                gates[1].release.resolve();
                await expectAppError(second);
                expect(results[firstName]).toEqual({ status: "fulfilled", value: id });
                expect(results[secondName]).toMatchObject({
                    status: "rejected",
                    reason: { code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 },
                });
                expect(completions).toEqual([firstName, secondName]);
                expect(reads).toEqual([
                    { name: firstName, phase: "started", transaction: a.transaction, pid: a.pid, found: undefined },
                    { name: firstName, phase: "acquired", transaction: a.transaction, pid: a.pid, found: true },
                    { name: secondName, phase: "started", transaction: b.transaction, pid: b.pid, found: undefined },
                    { name: secondName, phase: "acquired", transaction: b.transaction, pid: b.pid, found: false },
                ]);
                for (const read of reads) {
                    expect(read.transaction).toBe(read.name === firstName ? a.transaction : b.transaction);
                }
                expect(a.transaction).not.toBe(b.transaction);
                expectCopied(await snapshot("item_editing", id), original, f.owner.id);
                expect(await savedEditings(f)).toHaveLength(1);
                expect(await snapshot("item_draft", f.draft.id)).toBeNull();
                expect(create).toHaveBeenCalledOnce();
                expect(remove).toHaveBeenCalledOnce();
                expectLockSql();
                expect(create.mock.calls[0][0].transaction).toBe(a.transaction);
                expect(remove.mock.calls[0][0].transaction).toBe(a.transaction);
                expect(await protectedRows(f)).toEqual(protectedBefore);
            } finally {
                gates.forEach((gate) => gate.release.resolve());
                await settledFirst;
                if (settledSecond) await settledSecond;
            }
        },
        15000,
    );
    it("P02 AF-DB01: 先行INSERT後rollbackで後続が元下書きから生成し非対象行を保持する", async () => {
        const original = (await snapshot("item_draft", f.draft.id))!,
            gates = gateReads();
        const protectedBefore = await protectedRows(f);
        const realDelete = draftCommand.deleteItemDraft,
            error = new Error("先行削除失敗");
        let failedId: number | undefined;
        vi.spyOn(draftCommand, "deleteItemDraft").mockImplementation(async (params) => {
            const firstTransaction = (await gates[0].started.promise).transaction;
            if (params.transaction === firstTransaction) {
                const rows = await sequelize.query<{ id: number }>(
                    "SELECT id FROM item_editing WHERE seller_id=:owner AND id<>:existing",
                    {
                        replacements: { owner: f.owner.id, existing: f.editing.id },
                        transaction: params.transaction,
                        type: QueryTypes.SELECT,
                    },
                );
                expect(rows).toHaveLength(1);
                failedId = rows[0].id;
                throw error;
            }
            await realDelete(params);
        });
        const first = run(f),
            settledFirst = Promise.allSettled([first]);
        let second: Promise<number> | undefined, settledSecond: Promise<PromiseSettledResult<number>[]> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, first);
            second = run(f);
            settledSecond = Promise.allSettled([second]);
            const b = await waitForGate(gates[1].started.promise, second),
                a = await gates[0].started.promise;
            await waitBlocked(b.pid, a.pid, second);
            gates[0].release.resolve();
            await expect(first).rejects.toBe(error);
            await waitForGate(gates[1].entered.promise, second);
            expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
            expect(await snapshot("item_editing", failedId!)).toBeNull();
            gates[1].release.resolve();
            const id = await second;
            expectCopied(await snapshot("item_editing", id), original, f.owner.id);
            expect(await savedEditings(f)).toHaveLength(1);
            expect(await snapshot("item_draft", f.draft.id)).toBeNull();
            expectLockSql();
            expect(await protectedRows(f)).toEqual(protectedBefore);
        } finally {
            gates.forEach((gate) => gate.release.resolve());
            await settledFirst;
            if (settledSecond) await settledSecond;
        }
    }, 15000);
});

describe("P2: 下書きの変更が先行する競合", () => {
    it.each([
        { id: "P03", mode: "更新", end: "commit" },
        { id: "P04", mode: "削除", end: "commit" },
        { id: "P07", mode: "更新", end: "rollback" },
        { id: "P07", mode: "削除", end: "rollback" },
        { id: "P08", mode: "所有者変更", end: "commit" },
    ] as const)(
        "$id AF-DB01: 先行$modeの$end後に取得・コピーまたは404となり非対象行を保持する",
        async ({ mode, end }) => {
            const original = (await snapshot("item_draft", f.draft.id))!,
                gates = gateReads();
            const protectedBefore = await protectedRows(f);
            const create = vi.spyOn(editingCommand, "createItemEditingDraft"),
                remove = vi.spyOn(draftCommand, "deleteItemDraft");
            const external = await competitor.transaction();
            let ended = false;
            let pending: Promise<number> | undefined, settled: Promise<PromiseSettledResult<number>[]> | undefined;
            try {
                const pid = await transactionPid(competitor, external);
                expect(await changeDraft(external, mode)).toEqual([{ id: f.draft.id }]);
                pending = run(f);
                settled = Promise.allSettled([pending]);
                const a = await waitForGate(gates[0].started.promise, pending);
                await waitBlocked(a.pid, pid, pending);
                if (end === "commit") await external.commit();
                else await external.rollback();
                ended = true;
                // 後続usecaseがコピーする時点まで下書きが残る場合、commit済みsnapshotを比較元にする。
                const current = await snapshot("item_draft", f.draft.id);
                gates[0].release.resolve();
                if (end === "commit" && mode !== "更新") {
                    await expectAppError(pending);
                    expect(await savedEditings(f)).toEqual([]);
                    expect(create).not.toHaveBeenCalled();
                    expect(remove).not.toHaveBeenCalled();
                    if (mode === "削除") expect(current).toBeNull();
                    else expect(current).toEqual({ ...original, seller_id: f.other.id });
                } else {
                    const id = await pending;
                    expect(create).toHaveBeenCalledOnce();
                    expect(remove).toHaveBeenCalledOnce();
                    expectCopied(
                        await snapshot("item_editing", id),
                        end === "rollback" ? original : current!,
                        f.owner.id,
                    );
                    if (end === "commit") expect((await snapshot("item_editing", id))!.name).toBe("並行更新後");
                    expect(await snapshot("item_draft", f.draft.id)).toBeNull();
                    expect(await savedEditings(f)).toHaveLength(1);
                }
                expectLockSql();
                expect(await protectedRows(f)).toEqual(protectedBefore);
            } finally {
                if (!ended) await external.rollback();
                gates.forEach((gate) => gate.release.resolve());
                if (settled) await settled;
            }
        },
        15000,
    );
});

describe("P2: usecaseが先行する更新・削除競合", () => {
    it.each([
        { id: "P05", mode: "更新", rollback: false },
        { id: "P06", mode: "削除", rollback: false },
        { id: "P06", mode: "削除", rollback: true },
    ] as const)(
        "$id AF-DB01: 後続$modeは行ロック待機し先行rollback=$rollback後に再評価し非対象行を保持する",
        async ({ mode, rollback }) => {
            const original = (await snapshot("item_draft", f.draft.id))!,
                gates = gateReads();
            const protectedBefore = await protectedRows(f);
            const error = new Error("先行rollback");
            if (rollback) vi.spyOn(draftCommand, "deleteItemDraft").mockRejectedValue(error);
            const pending = run(f),
                settled = Promise.allSettled([pending]);
            let external: Transaction | undefined,
                ended = false;
            let update: ReturnType<typeof changeDraft> | undefined,
                settledUpdate: Promise<PromiseSettledResult<{ id: number }[]>[]> | undefined;
            try {
                await waitForGate(gates[0].entered.promise, pending);
                const a = await gates[0].started.promise;
                external = await competitor.transaction();
                const pid = await transactionPid(competitor, external);
                update = changeDraft(external, mode);
                settledUpdate = Promise.allSettled([update]);
                await waitBlocked(pid, a.pid, update);
                expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
                gates[0].release.resolve();
                if (rollback) await expect(pending).rejects.toBe(error);
                else expectCopied(await snapshot("item_editing", await pending), original, f.owner.id);
                expect(await update).toEqual(rollback ? [{ id: f.draft.id }] : []);
                await external.commit();
                ended = true;
                expect(await snapshot("item_draft", f.draft.id)).toBeNull();
                expect(await savedEditings(f)).toHaveLength(rollback ? 0 : 1);
                expectLockSql();
                expect(await protectedRows(f)).toEqual(protectedBefore);
            } finally {
                // 先行gateを先に解放して、待機SQLを回収した後に外側transactionを閉じる。
                gates.forEach((gate) => gate.release.resolve());
                await settled;
                if (settledUpdate) await settledUpdate;
                if (external && !ended) await external.rollback();
            }
        },
        15000,
    );
    it("P09 AF-DB02: 別所有者・別下書きは片方ロック保持中でも完了し値を混在させず非対象行を保持する", async () => {
        const originalA = (await snapshot("item_draft", f.draft.id))!,
            originalB = (await snapshot("item_draft", f.otherDraft.id))!;
        const protectedBefore = await protectedRows(f, [f.otherDraft.id]);
        const gates = gateReads();
        const first = run(f),
            settledFirst = Promise.allSettled([first]);
        let second: Promise<number> | undefined, settledSecond: Promise<PromiseSettledResult<number>[]> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, first);
            second = run(f, f.otherDraft.id, f.other.id);
            settledSecond = Promise.allSettled([second]);
            await waitForGate(gates[1].entered.promise, second);
            const a = await gates[0].started.promise,
                b = await gates[1].started.promise;
            expect(a.pid).not.toBe(b.pid);
            gates[1].release.resolve();
            const idB = await second;
            expectCopied(await snapshot("item_editing", idB), originalB, f.other.id);
            expect(await snapshot("item_draft", f.draft.id)).toEqual(originalA);
            gates[0].release.resolve();
            const idA = await first;
            expectCopied(await snapshot("item_editing", idA), originalA, f.owner.id);
            expect(await savedEditings(f)).toHaveLength(2);
            expect(await snapshot("item_draft", f.draft.id)).toBeNull();
            expect(await snapshot("item_draft", f.otherDraft.id)).toBeNull();
            expect(await protectedRows(f, [f.otherDraft.id])).toEqual(protectedBefore);
        } finally {
            gates.forEach((gate) => gate.release.resolve());
            await settledFirst;
            if (settledSecond) await settledSecond;
        }
    }, 15000);
});
