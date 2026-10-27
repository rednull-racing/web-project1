import { QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import { observer, sequelize } from "./databaseFixtures.js";
export { deferred } from "../../itemEditing/createItemEditingCopy/fixtures.js";

export const pid = async (transaction: Transaction) =>
    (
        await sequelize.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
            transaction,
            type: QueryTypes.SELECT,
        })
    )[0].pid;

export const boundary = async <T>(signal: Promise<T>, operation: Promise<unknown>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            signal,
            operation.then(
                () => {
                    throw new Error("operation ended before expected gate");
                },
                () => {
                    throw new Error("operation failed before expected gate");
                },
            ),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error("gate timeout")), 10000);
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
};

export const blocked = async (waiter: number, holder: number) => {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const [row] = await observer.query<{ blocked: boolean }>(
            "SELECT :holder = ANY(pg_blocking_pids(:waiter)) AS blocked",
            {
                replacements: { holder, waiter },
                type: QueryTypes.SELECT,
            },
        );
        if (row.blocked) return;
    }
    throw new Error("pg_blocking_pidsで対象接続間の実待機を確認できない");
};
