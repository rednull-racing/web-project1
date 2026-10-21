import "../../../../fixtures/itemDraft/deleteItemDraft/databaseSetup.js";
import { QueryTypes } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    seed,
    run,
    snapshot,
    protectedRows,
    competitor,
    observer,
    sequelize,
    ItemDraft,
    expectLockReleased,
} from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import { deferred, expectNotFound, waitForGate } from "../../../../fixtures/itemDraft/deleteItemDraft/fixtures.js";
import * as query from "../../../../../src/services/itemDraft/query.js";
import * as command from "../../../../../src/services/itemDraft/command.js";
import { deleteItemDraftController } from "../../../../../src/controllers/itemDraft/itemDraft.js";
import type { Request, Response } from "express";
let f: DbFixture;
beforeEach(async () => {
    f = await seed();
});
describe("P0/P1: 実transactionのcommit・rollback・待機", () => {
    it("T01: findOne/destroyまで同じt、commit後に対象なし", async () => {
        const get = vi.spyOn(query, "getMyItemDraft"),
            remove = vi.spyOn(command, "deleteItemDraft"),
            find = vi.spyOn(ItemDraft, "findOne"),
            destroy = vi.spyOn(ItemDraft.prototype, "destroy");
        await run(f);
        const t = get.mock.calls[0][0].transaction;
        expect(remove.mock.calls[0][0].transaction).toBe(t);
        expect(find.mock.calls[0][0]?.transaction).toBe(t);
        expect(destroy.mock.calls[0][0]?.transaction).toBe(t);
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
    });
    it.each(["取得後", "削除後"])("T02 T03: %sからcommitまで別接続に旧行が見える", async (stage) => {
        const entered = deferred<void>(),
            release = deferred<void>(),
            before = await snapshot("item_draft", f.draft.id);
        let local: Record<string, unknown> | null | undefined;
        if (stage === "取得後") {
            const real = query.getMyItemDraft;
            vi.spyOn(query, "getMyItemDraft").mockImplementationOnce(async (params) => {
                const row = await real(params);
                local = await snapshot("item_draft", f.draft.id, params.transaction);
                entered.resolve();
                await release.promise;
                return row;
            });
        } else {
            const real = command.deleteItemDraft;
            vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async (params) => {
                await real(params);
                local = await snapshot("item_draft", f.draft.id, params.transaction);
                entered.resolve();
                await release.promise;
            });
        }
        let completed = false;
        const pending = run(f).then(() => {
            completed = true;
        });
        try {
            await waitForGate(entered.promise, pending);
            expect(completed).toBe(false);
            expect(local).toEqual(stage === "取得後" ? before : null);
            expect(await snapshot("item_draft", f.draft.id)).toEqual(before);
        } finally {
            release.resolve();
            await pending;
        }
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
    });
    it.each(["取得前", "取得後", "削除前", "削除後"])(
        "T04 T05 T07: %s障害で全列rollbackし同じIDで再試行できる",
        async (stage) => {
            const before = await snapshot("item_draft", f.draft.id),
                protectedBefore = await protectedRows(f),
                error = new Error(stage);
            const realGet = query.getMyItemDraft,
                realRemove = command.deleteItemDraft;
            const get = vi.spyOn(query, "getMyItemDraft"),
                remove = vi.spyOn(command, "deleteItemDraft"),
                create = vi.spyOn(ItemDraft, "create");
            if (stage.startsWith("取得"))
                get.mockImplementationOnce(async (params) => {
                    if (stage === "取得後") await realGet(params);
                    throw error;
                });
            else
                remove.mockImplementationOnce(async (params) => {
                    if (stage === "削除後") {
                        await realRemove(params);
                        expect(await snapshot("item_draft", f.draft.id, params.transaction)).toBeNull();
                    }
                    throw error;
                });
            await expect(run(f)).rejects.toBe(error);
            expect(remove).toHaveBeenCalledTimes(stage.startsWith("取得") ? 0 : 1);
            expect(await snapshot("item_draft", f.draft.id)).toEqual(before);
            expect(await protectedRows(f)).toEqual(protectedBefore);
            expect(create).not.toHaveBeenCalled();
            await expectLockReleased(f.draft.id);
            await run(f);
            expect(await snapshot("item_draft", f.draft.id)).toBeNull();
            await expectNotFound(run(f));
        },
    );
    it("T06 T07: 実DELETEのテーブルロック待機をtimeoutしrollback後再試行", async () => {
        const before = await snapshot("item_draft", f.draft.id),
            protectedBefore = await protectedRows(f);
        const blocker = await competitor.transaction(),
            real = command.deleteItemDraft;
        const entered = deferred<number>();
        const [blockerRow] = await competitor.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
            type: QueryTypes.SELECT,
            transaction: blocker,
        });
        await competitor.query("LOCK TABLE item_draft IN SHARE MODE", { transaction: blocker });
        const remove = vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async (params) => {
            await sequelize.query("SET LOCAL lock_timeout = '1500ms'", { transaction: params.transaction });
            const [row] = await sequelize.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
                type: QueryTypes.SELECT,
                transaction: params.transaction,
            });
            entered.resolve(row.pid);
            await real(params);
        });
        const pending = run(f),
            result = Promise.allSettled([pending]);
        try {
            const pid = await waitForGate(entered.promise, pending);
            const deadline = Date.now() + 1000;
            let blocked = false;
            while (Date.now() < deadline) {
                const [row] = await observer.query<{ blocked: boolean }>(
                    "SELECT :blocker = ANY(pg_blocking_pids(:pid)) AS blocked",
                    { replacements: { blocker: blockerRow.pid, pid }, type: QueryTypes.SELECT },
                );
                if (row.blocked) {
                    blocked = true;
                    break;
                }
            }
            expect(blocked).toBe(true);
            await expect(pending).rejects.toMatchObject({
                name: "SequelizeDatabaseError",
                parent: { code: "55P03" },
                sql: expect.stringContaining("DELETE FROM"),
            });
        } finally {
            await blocker.rollback();
            await result;
        }
        expect(remove).toHaveBeenCalledOnce();
        expect(await snapshot("item_draft", f.draft.id)).toEqual(before);
        expect(await protectedRows(f)).toEqual(protectedBefore);
        await expectLockReleased(f.draft.id);
        await run(f);
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
    });
    it("T08: 404後も接続を返し別transactionで行を操作できる", async () => {
        await expectNotFound(run(f, f.otherDraft.id));
        await expectLockReleased(f.otherDraft.id);
        await expectLockReleased(f.draft.id);
    });
    it("T09: 実commit後の送信境界失敗では復元せず再送404", async () => {
        const error = new Error("通信失敗相当"),
            json = vi.fn(() => {
                throw error;
            }),
            next = vi.fn();
        const req = { user: { id: f.owner.id }, validatedParams: { id: f.draft.id } } as unknown as Request;
        const create = vi.spyOn(ItemDraft, "create");
        await deleteItemDraftController(
            req,
            { status: vi.fn().mockReturnValue({ json }) } as unknown as Response,
            next,
        );
        expect(next).toHaveBeenCalledExactlyOnceWith(error);
        expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        expect(create).not.toHaveBeenCalled();
        await expectNotFound(run(f));
    });
});
