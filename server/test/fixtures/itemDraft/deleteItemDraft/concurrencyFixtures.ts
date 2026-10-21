import { performance } from "node:perf_hooks";
import { setImmediate } from "node:timers/promises";
import { QueryTypes } from "sequelize";
import type { Sequelize, Transaction } from "sequelize";
import { vi } from "vitest";
import { sequelize, observer } from "./databaseFixtures.js";
import { deferred } from "./fixtures.js";
import * as query from "../../../../src/services/itemDraft/query.js";

export const transactionPid = async (connection: Sequelize, transaction: Transaction) => {
    await connection.query("SET LOCAL lock_timeout = '5000ms'", { transaction });
    const [row] = await connection.query<{ pid: number; isolation: string }>(
        "SELECT pg_backend_pid() AS pid, current_setting('transaction_isolation') AS isolation",
        { transaction, type: QueryTypes.SELECT },
    );
    if (row.isolation !== "read committed") throw new Error("DB_TEST_STOP: concurrency requires READ COMMITTED");
    return row.pid;
};
export const gateReads = (count = 2) => {
    const slots = Array.from({ length: count }, () => ({
        started: deferred<{ pid: number; transaction: Transaction }>(),
        entered: deferred<void>(),
        release: deferred<void>(),
    }));
    const real = query.getMyItemDraft;
    let index = 0;
    vi.spyOn(query, "getMyItemDraft").mockImplementation(async (params) => {
        const slot = slots[index++];
        if (!slot) throw new Error("想定外の取得回数");
        const pid = await transactionPid(sequelize, params.transaction);
        slot.started.resolve({ pid, transaction: params.transaction });
        const row = await real(params);
        slot.entered.resolve();
        await slot.release.promise;
        return row;
    });
    return slots;
};
export const waitBlocked = async (waiter: number, blocker: number, pending: Promise<unknown>) => {
    let finished = false;
    const observation = pending.then(
        () => {
            finished = true;
        },
        () => {
            finished = true;
        },
    );
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
        if (finished) {
            await observation;
            throw new Error("ロック待機確認前に処理が終了しました");
        }
        const [row] = await observer.query<{ blocked: boolean; wait_event_type: string | null }>(
            "SELECT :blocker = ANY(pg_blocking_pids(:waiter)) AS blocked, wait_event_type FROM pg_stat_activity WHERE pid = :waiter",
            { replacements: { waiter, blocker }, type: QueryTypes.SELECT },
        );
        if (row?.blocked && row.wait_event_type === "Lock") return;
        await setImmediate();
    }
    throw new Error("指定PID間の実ロック待機を期限内に確認できませんでした");
};
