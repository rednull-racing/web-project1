import "../../../../fixtures/backend/itemEditing/createItemEditingCopy/databaseSetup.js";
import { QueryTypes } from "sequelize";
import type { Sequelize, Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as query from "../../../../../src/services/items/index.js";
import * as command from "../../../../../src/services/itemEditing/command.js";
import type { GetMyItemWithVideoSaleShippingParams } from "../../../../../src/types/serviceType/items.js";
import {
    seed, run, snapshot, protectedSnapshot, editingIds, expectCopy, expectedCopy,
    sequelize, observer, Item, Video, Sale, ItemShippingProfile,
} from "../../../../fixtures/backend/itemEditing/createItemEditingCopy/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/backend/itemEditing/createItemEditingCopy/databaseFixtures.js";
import { deferred, expectAppError } from "../../../../fixtures/backend/itemEditing/createItemEditingCopy/fixtures.js";

let f: DbFixture;
beforeEach(async () => { f = await seed(); });
const boundary = <T>(signal: Promise<T>, pending: Promise<unknown>): Promise<T> =>
    Promise.race([signal, pending.then(() => { throw new Error("待合せ境界より前に処理が終了"); })]);
const backendPid = async (connection: Sequelize, transaction: Transaction) => {
    const [row] = await connection.query<{ pid: number }>("SELECT pg_backend_pid() AS pid", {
        transaction, type: QueryTypes.SELECT,
    });
    return row.pid;
};
const waitBlocked = async (waiter: number, holder: number) => {
    const deadline = Date.now() + 5000;
    // SQL応答で状態を再確認する。sleep時間からロック待ちを推測しない。
    while (Date.now() < deadline) {
        const [row] = await observer.query<{ blocked: boolean }>(
            "SELECT :holder = ANY(pg_blocking_pids(:waiter)) AS blocked",
            { replacements: { holder, waiter }, type: QueryTypes.SELECT },
        );
        if (row.blocked) return;
    }
    throw new Error("対象backend間の行ロック待機を確認できない");
};

// 実取得・実INSERTは置き換えず、その前後に通知と保留だけを挟む。
const gateCopies = (
    count: number,
    rollbackIndices: number[] = [],
    slotFor?: (params: GetMyItemWithVideoSaleShippingParams) => number,
) => {
    const started = Array.from({ length: count }, () => deferred<number>());
    const inserted = Array.from({ length: count }, () => deferred<number>());
    const release = Array.from({ length: count }, () => deferred<void>());
    const readDone = Array.from({ length: count }, () => false);
    const relatedReads = Array.from({ length: count }, () => 0);
    const createdIds: Array<number | undefined> = Array.from({ length: count });
    const slots = new Map<Transaction, number>();
    const occupied = new Set<number>();
    const rollbackError = new Error("コピー保存後rollback");
    let index = 0;
    const realGet = query.getMyItemWithVideoSaleShipping, realCreate = command.createItemEditingCopy;
    Item.addHook("beforeFind", "copyConcurrencyReads", (options) => {
        const slot = options.transaction ? slots.get(options.transaction) : undefined;
        if (slot !== undefined && Array.isArray(options.include) && options.include.length > 0) {
            relatedReads[slot]++;
        }
    });
    vi.spyOn(query, "getMyItemWithVideoSaleShipping").mockImplementation(async (params: GetMyItemWithVideoSaleShippingParams) => {
        if (!params.transaction) throw new Error("コピー取得にtransactionがない");
        const slot = slotFor ? slotFor(params) : index++;
        if (slot < 0 || slot >= count || occupied.has(slot)) throw new Error("想定外の取得回数または呼出元");
        occupied.add(slot);
        slots.set(params.transaction, slot);
        started[slot].resolve(await backendPid(sequelize, params.transaction));
        const result = await realGet(params);
        readDone[slot] = true;
        return result;
    });
    const createSpy = vi.spyOn(command, "createItemEditingCopy").mockImplementation(async (params) => {
        const slot = slots.get(params.transaction);
        if (slot === undefined) throw new Error("取得と作成のtransactionが異なる");
        const row = await realCreate(params);
        createdIds[slot] = row.id;
        inserted[slot].resolve(row.id);
        await release[slot].promise;
        if (rollbackIndices.includes(slot)) throw rollbackError;
        return row;
    });
    const finish = () => {
        release.forEach((gate) => gate.resolve());
        Item.removeHook("beforeFind", "copyConcurrencyReads");
    };
    return { started, inserted, release, readDone, relatedReads, createdIds, createSpy, rollbackError, finish };
};

describe("P2 同一商品・別商品の並行コピー", () => {
    it.each(["A先行", "B先行"])("P01: %sで先行commit後に後続も新規生成する", async (order) => {
        const gate = gateCopies(2), before = await protectedSnapshot(f), ids = await editingIds(f);
        const callers = {
            A: () => run(f).then((id) => ({ caller: "A", id })),
            B: () => run(f).then((id) => ({ caller: "B", id })),
        };
        const leading = order === "A先行" ? "A" : "B";
        const trailing = leading === "A" ? "B" : "A";
        const firstCall = callers[leading]();
        const first = firstCall.then((result) => result.id), pending: Promise<number>[] = [first];
        let settled: Promise<PromiseSettledResult<number>[]> | undefined;
        try {
            await boundary(gate.inserted[0].promise, first);
            const secondCall = callers[trailing]();
            const second = secondCall.then((result) => result.id);
            pending.push(second); settled = Promise.allSettled(pending);
            const waiter = await boundary(gate.started[1].promise, second), holder = await gate.started[0].promise;
            await waitBlocked(waiter, holder);
            expect(gate.relatedReads[1]).toBe(0);
            expect(gate.readDone[1]).toBe(false); expect(gate.createSpy).toHaveBeenCalledTimes(1);
            gate.release[0].resolve();
            const firstId = await first;
            const secondId = await boundary(gate.inserted[1].promise, second);
            expect(firstId).not.toBe(secondId);
            gate.release[1].resolve(); await second;
            expect(await firstCall).toEqual({ caller: leading, id: firstId });
            expect(await secondCall).toEqual({ caller: trailing, id: secondId });
            expect(gate.relatedReads).toEqual([1, 1]);
            await expectCopy(firstId, expectedCopy(f)); await expectCopy(secondId, expectedCopy(f));
            expect(await editingIds(f)).toEqual([...ids, firstId, secondId].sort((a, b) => a - b));
            expect(await protectedSnapshot(f)).toEqual(before);
        } finally {
            gate.finish();
            await (settled ?? Promise.allSettled(pending));
        }
    }, 20000);
    it("P02: 先行の実INSERTがrollbackされても待機中の後続は作成できる", async () => {
        const gate = gateCopies(2, [0]), before = await protectedSnapshot(f), ids = await editingIds(f);
        const first = run(f), pending: Promise<number>[] = [first];
        const rejection = expect(first).rejects.toBe(gate.rollbackError);
        try {
            await boundary(gate.inserted[0].promise, first);
            const second = run(f); pending.push(second);
            const settled = Promise.allSettled(pending);
            await waitBlocked(await boundary(gate.started[1].promise, second), await gate.started[0].promise);
            expect(gate.relatedReads[1]).toBe(0);
            expect(gate.readDone[1]).toBe(false); expect(gate.createSpy).toHaveBeenCalledTimes(1);
            gate.release[0].resolve(); await rejection;
            const id = await boundary(gate.inserted[1].promise, second);
            gate.release[1].resolve(); await settled;
            expect(await second).toBe(id);
            expect(await snapshot("item_editing", gate.createdIds[0]!)).toBeNull();
            await expectCopy(id, expectedCopy(f));
            expect(await editingIds(f)).toEqual([...ids, id].sort((a, b) => a - b));
            expect(await protectedSnapshot(f)).toEqual(before);
        } finally {
            gate.finish(); await Promise.allSettled(pending); await rejection;
        }
    }, 20000);
    it("P08: 別ユーザーの別商品は両方INSERTまで進み逆順commitでも混ざらない", async () => {
        const gate = gateCopies(2, [], (params) => {
            if (params.itemId === f.item.id && params.userId === f.owner.id) return 0;
            if (params.itemId === f.otherItem.id && params.userId === f.other.id) return 1;
            throw new Error("別商品テストに想定外の入力");
        });
        const before = await protectedSnapshot(f), ids = await editingIds(f);
        const first = run(f), second = run(f, f.otherItem.id, f.other.id);
        const settled = Promise.allSettled([first, second]);
        try {
            const [a, b] = await Promise.all([
                boundary(gate.inserted[0].promise, first), boundary(gate.inserted[1].promise, second),
            ]);
            expect(a).not.toBe(b);
            expect(await gate.started[0].promise).not.toBe(await gate.started[1].promise);
            gate.release[1].resolve(); await second;
            expect(await snapshot("item_editing", a)).toBeNull();
            gate.release[0].resolve(); await first;
            await expectCopy(a, expectedCopy(f));
            await expectCopy(b, {
                ...expectedCopy(f), seller_id: f.other.id, name: "別商品", title: "別動画",
                price: 23000, before_price: 23000, shipping_service_free_text: "別配送",
            });
            expect(gate.createSpy).toHaveBeenCalledTimes(2);
            expect(await editingIds(f)).toEqual([...ids, a, b].sort((left, right) => left - right));
            expect(await protectedSnapshot(f)).toEqual(before);
        } finally { gate.finish(); await settled; }
    }, 20000);
});

describe("P2 先行する更新・所有権変更・削除とロック後の再評価", () => {
    const changes = ["商品と関連更新", "soldout", "所有者変更", "削除"] as const;
    describe.each(changes)("%s", (change) => {
        it.each(["commit", "rollback"] as const)(
            "P03 P04 P05 P06 P07: 先行変更の%s後のデータでコピーまたは404にする", async (outcome) => {
                const writerReady = deferred<number>(), writerRelease = deferred<void>();
                const rollbackError = new Error("writer rollback");
                const idsBefore = await editingIds(f), protectedBefore = await protectedSnapshot(f);
                const writer = observer.transaction(async (transaction) => {
                    await observer.query("SELECT id FROM item WHERE id = :id FOR UPDATE", {
                        replacements: { id: f.item.id }, transaction,
                    });
                    if (change === "商品と関連更新") {
                        const video = await Video.create({
                            thumbnail_url: "fresh-thumb", title: "fresh-title", summary: "fresh-summary",
                            duration: 88, original_url: "fresh-original", converted_url: "fresh-converted", status: "fresh-status",
                        }, { transaction });
                        const sale = await Sale.create({ before_price: 18500, discount_rate: 10, discount_amount: 1850, sale_flag: true }, { transaction });
                        const shipping = await ItemShippingProfile.create({
                            shipping_day_id: f.day.id, shipping_service_id: f.service.id, shipping_place_id: f.place.id,
                            shipping_service_free_text: "fresh-shipping",
                        }, { transaction });
                        await Item.update({
                            name: "fresh-name", image_url: ["fresh-image"], video_id: video.id, sale_id: sale.id,
                            shipping_id: shipping.id,
                            attributes: { inventory: { initial: 45, current: 2, low_stock_ratio: 0.8 } },
                        }, { where: { id: f.item.id }, transaction });
                    } else if (change === "soldout") {
                        await Item.update({ status: "soldout" }, { where: { id: f.item.id }, transaction });
                    } else if (change === "所有者変更") {
                        await Item.update({ seller_id: f.other.id }, { where: { id: f.item.id }, transaction });
                    } else {
                        await Item.destroy({ where: { id: f.item.id }, transaction });
                    }
                    writerReady.resolve(await backendPid(observer, transaction));
                    await writerRelease.promise;
                    if (outcome === "rollback") throw rollbackError;
                });
                const writerAssertion = outcome === "rollback" ? expect(writer).rejects.toBe(rollbackError) : expect(writer).resolves.toBeUndefined();
                const gate = gateCopies(1);
                let copy: Promise<number> | undefined;
                let copyRejection: Promise<void> | undefined;
                try {
                    const holder = await boundary(writerReady.promise, writer);
                    copy = run(f);
                    const fails = outcome === "commit" && change !== "商品と関連更新";
                    if (fails) copyRejection = expectAppError(copy);
                    const waiter = await boundary(gate.started[0].promise, copy);
                    await waitBlocked(waiter, holder);
                    expect(gate.relatedReads[0]).toBe(0);
                    expect(gate.readDone[0]).toBe(false); expect(gate.createSpy).not.toHaveBeenCalled();
                    writerRelease.resolve(); await writerAssertion;
                    const afterWriter = await protectedSnapshot(f), idsAfterWriter = await editingIds(f);
                    if (fails) {
                        await copyRejection;
                        expect(gate.createSpy).not.toHaveBeenCalled();
                        expect(gate.relatedReads[0]).toBe(change === "soldout" ? 1 : 0);
                        expect(await editingIds(f)).toEqual(idsAfterWriter);
                        expect(await protectedSnapshot(f)).toEqual(afterWriter);
                    } else {
                        const id = await boundary(gate.inserted[0].promise, copy);
                        gate.release[0].resolve(); await copy;
                        const expected = outcome === "rollback" ? expectedCopy(f) : {
                            ...expectedCopy(f), name: "fresh-name", image_url: ["fresh-image"],
                            thumbnail_url: "fresh-thumb", title: "fresh-title", summary: "fresh-summary",
                            duration: 88, original_url: "fresh-original", converted_url: "fresh-converted", video_status: "fresh-status",
                            before_price: 18500, price: 18500, shipping_service_free_text: "fresh-shipping",
                            attributes: { inventory: { initial: 45, current: 45, low_stock_ratio: 0.8 } },
                        };
                        await expectCopy(id, expected);
                        expect(await editingIds(f)).toEqual([...idsAfterWriter, id].sort((a, b) => a - b));
                        expect(await protectedSnapshot(f)).toEqual(afterWriter);
                    }
                    if (outcome === "rollback") {
                        expect(await protectedSnapshot(f)).toEqual(protectedBefore);
                        expect(await editingIds(f)).toHaveLength(idsBefore.length + 1);
                    }
                } finally {
                    writerRelease.resolve(); gate.finish();
                    await Promise.allSettled(copy ? [writer, copy] : [writer]);
                    await writerAssertion; if (copyRejection) await copyRejection;
                }
            }, 25000,
        );
    });
    it.each(["更新", "削除"])("P09: コピーが先にロックした場合は%s側がcommitを待つ", async (change) => {
        const gate = gateCopies(1), copy = run(f), writerStarted = deferred<number>();
        let writer: Promise<void> | undefined;
        try {
            const id = await boundary(gate.inserted[0].promise, copy);
            writer = observer.transaction(async (transaction) => {
                writerStarted.resolve(await backendPid(observer, transaction));
                await observer.query("SELECT id FROM item WHERE id = :id FOR UPDATE", {
                    replacements: { id: f.item.id }, transaction,
                });
                if (change === "削除") await Item.destroy({ where: { id: f.item.id }, transaction });
                else await Item.update({ name: "後続更新" }, { where: { id: f.item.id }, transaction });
            });
            await waitBlocked(await boundary(writerStarted.promise, writer), await gate.started[0].promise);
            gate.release[0].resolve(); await copy; await writer;
            await expectCopy(id, expectedCopy(f));
            if (change === "削除") expect(await snapshot("item", f.item.id)).toBeNull();
            else expect((await snapshot("item", f.item.id))!.name).toBe("後続更新");
        } finally { gate.finish(); await Promise.allSettled(writer ? [copy, writer] : [copy]); }
    }, 20000);
});

describe("P2 関連テーブルだけの更新に関する観測", () => {
    it.each(["再取得前", "再取得後"])("O03: %sに関連だけを更新した時のコピー値を確認する", async (point) => {
        const entered = deferred<void>(), release = deferred<void>();
        const real = command.createItemEditingCopy;
        if (point === "再取得前") {
            Item.addHook("afterFind", "copyBeforeReload", async (_row, options) => {
                if (options.transaction && Array.isArray(options.attributes) && options.attributes.length === 1 &&
                    options.attributes[0] === "id") {
                    entered.resolve(); await release.promise;
                }
            });
        } else {
            vi.spyOn(command, "createItemEditingCopy").mockImplementation(async (params) => {
                const row = await real(params); entered.resolve(); await release.promise; return row;
            });
        }
        const copy = run(f), settled = Promise.allSettled([copy]);
        try {
            await boundary(entered.promise, copy);
            // 商品本体を変更しないUPDATEは、コピーのItemロックと独立に完了できる。
            await observer.transaction(async (transaction) => {
                await observer.query("SET LOCAL lock_timeout = '2s'", { transaction });
                await Video.update({ title: "関連のみ更新" }, { where: { id: f.video.id }, transaction });
                await Sale.update({ before_price: 24680 }, { where: { id: f.sale.id }, transaction });
                await ItemShippingProfile.update({ shipping_service_free_text: "関連配送" }, {
                    where: { id: f.shipping.id }, transaction,
                });
            });
            release.resolve();
            const id = await copy;
            await expectCopy(id, point === "再取得前" ? {
                ...expectedCopy(f), title: "関連のみ更新", before_price: 24680, price: 24680, shipping_service_free_text: "関連配送",
            } : expectedCopy(f));
            expect((await snapshot("video", f.video.id))!.title).toBe("関連のみ更新");
            expect((await snapshot("sale", f.sale.id))!.before_price).toBe(24680);
        } finally {
            release.resolve(); await settled; Item.removeHook("afterFind", "copyBeforeReload");
        }
    }, 20000);
});
