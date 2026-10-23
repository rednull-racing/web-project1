import "../../../../fixtures/items/updateItem/databaseSetup.js";
import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";
import {
    seed, run, snapshot, targetSnapshot, nonTargetSnapshot, notification, sequelize, ItemEditing, Item,
} from "../../../../fixtures/items/updateItem/databaseFixtures.js";
import { deferred, boundary, blocked, pid } from "../../../../fixtures/items/updateItem/concurrencyFixtures.js";
import * as query from "../../../../../src/services/itemEditing/query.js";
import * as targetQuery from "../../../../../src/services/items/query/relation.js";
import * as command from "../../../../../src/services/itemEditing/command.js";

type Result = { id: number } | { error: unknown };
const resultOf = (operation: Promise<number>): Promise<Result> => operation.then((id) => ({ id }), (error: unknown) => ({ error }));
const extraEditing = async (f: Awaited<ReturnType<typeof seed>>, other = false) => {
    const data = structuredClone(f.editing.get({ plain: true }));
    delete data.id; delete data.createdAt; delete data.updatedAt;
    return ItemEditing.create({ ...data, name: "後続セッション", item_id: other ? f.otherItem.id : f.item.id,
        seller_id: other ? f.other.id : f.owner.id, price: 7654 });
};

describe("P01 同一セッション/同一商品への実行競合", () => {
    it.each([false, true])("P01: 同一セッション先行rollback=%sを実待機して再判定", async (rollback) => {
        const f = await seed();
        const locked = deferred<number>(), started = deferred<number>(), release = deferred<void>();
        const original = query.getMyItemEditing, originalDelete = command.deleteItemEditing;
        let index = 0, firstTransaction: Transaction | undefined;
        vi.spyOn(query, "getMyItemEditing").mockImplementation(async (args) => {
            const slot = index++, backend = await pid(args.transaction!);
            if (slot === 1) started.resolve(backend);
            const row = await original(args);
            if (slot === 0) { firstTransaction = args.transaction; locked.resolve(backend); await release.promise; }
            return row;
        });
        const failure = new Error("rollback-first-after-delete");
        if (rollback) vi.spyOn(command, "deleteItemEditing").mockImplementation(async (args) => {
            await originalDelete(args); if (args.transaction === firstTransaction) throw failure;
        });
        const first = resultOf(run(f));
        let second: Promise<Result> | undefined;
        try {
            const holder = await boundary(locked.promise, first);
            second = resultOf(run(f));
            await blocked(await boundary(started.promise, second), holder);
            expect(notification).not.toHaveBeenCalled();
            release.resolve();
            const [a, b] = await Promise.all([first, second]);
            expect(a).toEqual(rollback ? { error: failure } : { id: f.item.id });
            if (rollback) expect(b).toEqual({ id: f.item.id });
            else expect(b).toMatchObject({ error: { code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 } });
            expect(await snapshot("item_editing", f.editing.id)).toBeNull();
            expect((await snapshot("item", f.item.id))!.name).toBe("新商品Ａ");
            expect(notification).toHaveBeenCalledTimes(1);
        } finally { release.resolve(); await Promise.allSettled([first, ...(second ? [second] : [])]); }
    });
    it("P01: 別セッション同一商品はItemロックで直列化し後続の値を保存", async () => {
        const f = await seed(), extra = await extraEditing(f);
        const protectedBefore = await nonTargetSnapshot(f);
        const locked = deferred<number>(), started = deferred<number>(), release = deferred<void>();
        const original = targetQuery.getMyItemForUpdate;
        let index = 0;
        vi.spyOn(targetQuery, "getMyItemForUpdate").mockImplementation(async (args) => {
            const slot = index++, backend = await pid(args.transaction);
            if (slot === 1) started.resolve(backend);
            const target = await original(args);
            if (slot === 0) { locked.resolve(backend); await release.promise; }
            return target;
        });
        const first = resultOf(run(f));
        let second: Promise<Result> | undefined;
        try {
            const holder = await boundary(locked.promise, first);
            second = resultOf(run(f, extra.id));
            await blocked(await boundary(started.promise, second), holder);
            expect(notification).not.toHaveBeenCalled();
            release.resolve();
            expect(await first).toEqual({ id: f.item.id }); expect(await second).toEqual({ id: f.item.id });
            expect((await snapshot("item", f.item.id))!.name).toBe("後続セッション");
            expect((await snapshot("item", f.item.id))!.price).toBe(7654);
            expect(await snapshot("item_editing", extra.id)).toBeNull();
            expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
            expect(notification).toHaveBeenCalledTimes(2);
        } finally { release.resolve(); await Promise.allSettled([first, ...(second ? [second] : [])]); }
    });
    it("P01: 別商品は各ロック取得後に独立して完了する", async () => {
        const f = await seed(), extra = await extraEditing(f, true);
        const bothLocked = deferred<void>(), release = deferred<void>();
        const original = targetQuery.getMyItemForUpdate;
        let count = 0;
        vi.spyOn(targetQuery, "getMyItemForUpdate").mockImplementation(async (args) => {
            const target = await original(args); if (++count === 2) bothLocked.resolve(); await release.promise; return target;
        });
        const pending = Promise.all([run(f), run(f, extra.id, f.other.id)]);
        try { await boundary(bothLocked.promise, pending); expect(notification).not.toHaveBeenCalled(); }
        finally { release.resolve(); await pending; }
        expect(await pending).toEqual([f.item.id, f.otherItem.id]);
        expect((await snapshot("item", f.item.id))!.name).toBe("新商品Ａ");
        expect((await snapshot("item", f.otherItem.id))!.name).toBe("後続セッション");
        expect(notification).toHaveBeenCalledTimes(2);
    });
});

const scenarios = ["session-save", "session-owner", "session-delete", "session-normal", "item-owner", "item-delete", "item-soldout"] as const;
describe("P02 待機後の最新セッション/商品所有者と削除の再判定", () => {
    it.each(scenarios.flatMap((action) => [false, true].map((rollback) => ({ action, rollback }))))(
        "P02: $action rollback=$rollback後の結果を再判定", async ({ action, rollback }) => {
            const f = await seed();
            const protectedBefore = await nonTargetSnapshot(f);
            const holder = await sequelize.transaction();
            let closed = false, pending: Promise<Result> | undefined;
            const started = deferred<number>();
            try {
                const holderPid = await pid(holder);
                if (action.startsWith("session-")) {
                    await ItemEditing.findByPk(f.editing.id, { transaction: holder, lock: holder.LOCK.UPDATE });
                    if (action === "session-delete") await ItemEditing.destroy({ where: { id: f.editing.id }, transaction: holder });
                    else await ItemEditing.update(action === "session-owner" ? { seller_id: f.other.id }
                        : action === "session-normal" ? { status: "normal" }
                        : { name: "最新保存", price: 5432, attributes: { inventory: { initial: 0, current: 999, low_stock_ratio: 0.25 } } },
                        { where: { id: f.editing.id }, transaction: holder });
                } else {
                    await Item.findByPk(f.item.id, { transaction: holder, lock: holder.LOCK.UPDATE });
                    if (action === "item-delete") await Item.destroy({ where: { id: f.item.id }, transaction: holder });
                    else await Item.update(action === "item-owner" ? { seller_id: f.other.id } : { status: "soldout" }, { where: { id: f.item.id }, transaction: holder });
                }
                if (action === "item-owner" || action === "item-soldout") {
                    const real = targetQuery.getMyItemForUpdate;
                    vi.spyOn(targetQuery, "getMyItemForUpdate").mockImplementation(async (args) => { started.resolve(await pid(args.transaction)); return real(args); });
                } else {
                    const real = query.getMyItemEditing;
                    vi.spyOn(query, "getMyItemEditing").mockImplementation(async (args) => { started.resolve(await pid(args.transaction!)); return real(args); });
                }
                pending = resultOf(run(f));
                await blocked(await boundary(started.promise, pending), holderPid);
                expect(notification).not.toHaveBeenCalled();
                if (rollback) await holder.rollback(); else await holder.commit();
                closed = true;
                const result = await pending;
                const success = rollback || action === "session-save" || action === "item-soldout";
                if (success) {
                    expect(result).toEqual({ id: f.item.id });
                    const item = await snapshot("item", f.item.id);
                    expect(item!.name).toBe(!rollback && action === "session-save" ? "最新保存" : "新商品Ａ");
                    expect(item!.status).toBe(!rollback && action === "session-save" ? "soldout" : "active");
                    expect(await snapshot("item_editing", f.editing.id)).toBeNull();
                    expect(notification).toHaveBeenCalledTimes(1);
                } else {
                    expect(result).toMatchObject({ error: { code: action === "item-owner" ? "ITEM_NOT_FOUND"
                        : action === "session-normal" ? "ITEM_EDITING_STATE_INVALID" : "ITEM_EDITING_NOT_FOUND" } });
                    expect(notification).not.toHaveBeenCalled();
                    if (action === "item-delete") expect(await snapshot("item", f.item.id)).toBeNull();
                    else expect((await snapshot("item", f.item.id))!.name).toBe(f.item.name);
                }
                expect(await nonTargetSnapshot(f)).toEqual(protectedBefore);
            } finally {
                if (!closed) await holder.rollback();
                if (pending) await pending;
            }
        },
    );
    it("P02: commit前は別接続に旧商品が見え、解放後は更新済み商品だけが見える", async () => {
        const f = await seed(), before = await targetSnapshot(f);
        const deleted = deferred<void>(), release = deferred<void>();
        const real = command.deleteItemEditing;
        vi.spyOn(command, "deleteItemEditing").mockImplementationOnce(async (args) => { await real(args); deleted.resolve(); await release.promise; });
        const pending = run(f);
        try {
            await boundary(deleted.promise, pending);
            expect(await targetSnapshot(f)).toEqual(before);
            expect(notification).not.toHaveBeenCalled();
        } finally { release.resolve(); await pending; }
        expect((await snapshot("item", f.item.id))!.name).toBe("新商品Ａ");
        expect(await snapshot("item_editing", f.editing.id)).toBeNull();
        expect(notification).toHaveBeenCalledTimes(1);
    });
});
