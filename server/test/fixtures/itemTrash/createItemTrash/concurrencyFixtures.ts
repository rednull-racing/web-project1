import { performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import { vi } from "vitest";
import { sequelize, observer } from "./databaseFixtures.js";
import * as query from "../../../../src/services/itemTrash/query.js";

export const deferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    const promise = new Promise<T>((res) => {
        resolve = res;
    });
    return { promise, resolve };
};
export const waitForGate = async <T>(signal: Promise<T>, pending: Promise<unknown>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            signal,
            pending.then(() => {
                throw new Error("gate到達前に処理が完了しました");
            }),
            new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error("gate待機期限超過")), 5000);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};
export const gateReads = () => {
    const slots = Array.from({ length: 2 }, () => ({
        started: deferred<{ pid: number; transaction: Transaction }>(),
        entered: deferred<void>(),
        release: deferred<void>(),
    }));
    const real = query.getMyItemForTrash;
    let index = 0;
    vi.spyOn(query, "getMyItemForTrash").mockImplementation(async (params) => {
        const slot = slots[index++];
        if (!slot) throw new Error("想定外の取得回数");
        await sequelize.query("SET LOCAL lock_timeout = '5000ms'", { transaction: params.transaction });
        const [row] = await sequelize.query<{ pid: number; isolation: string }>(
            "SELECT pg_backend_pid() AS pid, current_setting('transaction_isolation') AS isolation",
            { transaction: params.transaction, type: QueryTypes.SELECT },
        );
        if (row.isolation !== "read committed") throw new Error("DB_TEST_STOP: concurrency requires READ COMMITTED");
        slot.started.resolve({ pid: row.pid, transaction: params.transaction });
        const result = await real(params);
        slot.entered.resolve();
        await slot.release.promise;
        return result;
    });
    return slots;
};
export const waitBlocked = async (waiter: number, blocker: number, pending: Promise<unknown>) => {
    let finished = false;
    void pending.then(
        () => {
            finished = true;
        },
        () => {
            finished = true;
        },
    );
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
        if (finished) throw new Error("ロック待機確認前に処理が終了しました");
        const [row] = await observer.query<{ blocked: boolean; wait_event_type: string | null }>(
            "SELECT :blocker = ANY(pg_blocking_pids(:waiter)) AS blocked, wait_event_type FROM pg_stat_activity WHERE pid = :waiter",
            { replacements: { waiter, blocker }, type: QueryTypes.SELECT },
        );
        if (row?.blocked && row.wait_event_type === "Lock") return;
        await setImmediate();
    }
    throw new Error("指定PID間の実ロック待機を期限内に確認できませんでした");
};
