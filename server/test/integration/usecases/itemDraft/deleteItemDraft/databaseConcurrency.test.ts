import "../../../../fixtures/itemDraft/deleteItemDraft/databaseSetup.js";
import { QueryTypes } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { seed, run, snapshot, protectedRows, savedEditings, expectCopied, competitor } from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemDraft/deleteItemDraft/databaseFixtures.js";
import { expectNotFound, waitForGate } from "../../../../fixtures/itemDraft/deleteItemDraft/fixtures.js";
import { gateReads, transactionPid, waitBlocked } from "../../../../fixtures/itemDraft/deleteItemDraft/concurrencyFixtures.js";
import * as command from "../../../../../src/services/itemDraft/command.js";
import * as editingCommand from "../../../../../src/services/itemEditing/command.js";
import { createItemEditingDraftUseCase } from "../../../../../src/usecases/itemEditing/createItemEditingDraft.js";
let f: DbFixture;
beforeEach(async () => { f = await seed(); });
const edit = () => createItemEditingDraftUseCase({ itemDraftId: f.draft.id, userId: f.owner.id });

describe("P2: 実FOR UPDATEの削除競合", () => {
    it.each(["A先行", "B先行"])("P01: %sで同じ下書きの削除は1件成功・後続404", async () => {
        const gates = gateReads(), before = await protectedRows(f), remove = vi.spyOn(command, "deleteItemDraft");
        const a = run(f), settledA = Promise.allSettled([a]); let b: Promise<void> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, a); const first = await gates[0].started.promise;
            b = run(f); const second = await waitForGate(gates[1].started.promise, b);
            await waitBlocked(second.pid, first.pid, b);
            gates[0].release.resolve(); await a;
            await waitForGate(gates[1].entered.promise, b); gates[1].release.resolve(); await expectNotFound(b);
            expect(remove).toHaveBeenCalledOnce(); expect(await snapshot("item_draft", f.draft.id)).toBeNull();
            expect(await protectedRows(f)).toEqual(before);
        } finally { gates.forEach(g => g.release.resolve()); await settledA; if (b) await Promise.allSettled([b]); }
    });
    it("P02: 先行が実destroy後rollbackすると後続が残存行を削除", async () => {
        const gates = gateReads(), before = await protectedRows(f), original = await snapshot("item_draft", f.draft.id), error = new Error("先行rollback"), real = command.deleteItemDraft;
        vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async params => { await real(params); throw error; });
        const a = run(f), settledA = Promise.allSettled([a]); let b: Promise<void> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, a); b = run(f);
            const second = await waitForGate(gates[1].started.promise, b), first = await gates[0].started.promise;
            await waitBlocked(second.pid, first.pid, b); gates[0].release.resolve(); await expect(a).rejects.toBe(error);
            await waitForGate(gates[1].entered.promise, b);
            expect(await snapshot("item_draft", f.draft.id)).toEqual(original);
            gates[1].release.resolve(); await b;
            expect(await snapshot("item_draft", f.draft.id)).toBeNull(); expect(await protectedRows(f)).toEqual(before);
        } finally { gates.forEach(g => g.release.resolve()); await settledA; if (b) await Promise.allSettled([b]); }
    });
    it.each([
        { id: "P03", first: "編集", rollback: false }, { id: "P04", first: "編集", rollback: true },
        { id: "P05", first: "削除", rollback: false }, { id: "P06", first: "削除", rollback: true },
    ])("$id: $first先行・rollback=$rollbackで編集開始と削除を排他する", async ({ first, rollback }) => {
        const gates = gateReads(), original = await snapshot("item_draft", f.draft.id), before = await protectedRows(f);
        const error = new Error("先行実削除後rollback"), realRemove = command.deleteItemDraft;
        let localEditing: Record<string, unknown>[] = [];
        const realCreate = editingCommand.createItemEditingDraft;
        vi.spyOn(editingCommand, "createItemEditingDraft").mockImplementation(async params => {
            const row = await realCreate(params); localEditing.push(row.toJSON()); return row;
        });
        if (rollback) vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async params => { await realRemove(params); throw error; });
        const a: Promise<unknown> = first === "編集" ? edit() : run(f), settledA = Promise.allSettled([a]);
        let b: Promise<unknown> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, a); b = first === "編集" ? run(f) : edit();
            const second = await waitForGate(gates[1].started.promise, b), holder = await gates[0].started.promise;
            await waitBlocked(second.pid, holder.pid, b);
            gates[0].release.resolve();
            if (rollback) await expect(a).rejects.toBe(error); else await a;
            await waitForGate(gates[1].entered.promise, b); gates[1].release.resolve();
            if (rollback) await b; else await expectNotFound(b);
            const rows = await savedEditings(f), editingSucceeded = (first === "編集" && !rollback) || (first === "削除" && rollback);
            expect(rows).toHaveLength(editingSucceeded ? 1 : 0);
            if (editingSucceeded) expectCopied(rows[0], original!, f.owner.id);
            if (first === "編集" && rollback) expect(localEditing).toHaveLength(1);
            expect(await snapshot("item_draft", f.draft.id)).toBeNull(); expect(await protectedRows(f)).toEqual(before);
        } finally { gates.forEach(g => g.release.resolve()); await settledA; if (b) await Promise.allSettled([b]); localEditing = []; }
    });
    it.each([false, true])("P07: 別ユーザー・別行は先行rollback=%sと独立して完了", async rollback => {
        const gates = gateReads(), error = new Error("D1失敗"), real = command.deleteItemDraft;
        const before = await protectedRows(f, [f.otherDraft.id]);
        if (rollback) vi.spyOn(command, "deleteItemDraft").mockImplementation(async params => { await real(params); if (params.itemDraft.id === f.draft.id) throw error; });
        const a = run(f), settledA = Promise.allSettled([a]); let b: Promise<void> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, a);
            b = run(f, f.otherDraft.id, f.other.id);
            await waitForGate(gates[1].entered.promise, b); gates[1].release.resolve(); await b;
            expect(await snapshot("item_draft", f.otherDraft.id)).toBeNull();
            expect(await snapshot("item_draft", f.draft.id)).not.toBeNull();
            gates[0].release.resolve(); if (rollback) await expect(a).rejects.toBe(error); else await a;
            expect(await snapshot("item_draft", f.draft.id)).toEqual(rollback ? expect.any(Object) : null);
            expect(await protectedRows(f, [f.otherDraft.id])).toEqual(before);
        } finally { gates.forEach(g => g.release.resolve()); await settledA; if (b) await Promise.allSettled([b]); }
    });
    it.each([false, true])("P08: 削除ロック後の所有者変更は先行rollback=%sまで待つ", async rollback => {
        const gates = gateReads(1), error = new Error("先行rollback"), real = command.deleteItemDraft;
        if (rollback) vi.spyOn(command, "deleteItemDraft").mockImplementationOnce(async params => { await real(params); throw error; });
        const a = run(f), settledA = Promise.allSettled([a]), external = await competitor.transaction();
        let update: Promise<{ id: number }[]> | undefined, externalDone = false;
        try {
            await waitForGate(gates[0].entered.promise, a);
            const pid = await transactionPid(competitor, external), first = await gates[0].started.promise;
            update = competitor.query<{ id: number }>("UPDATE item_draft SET seller_id = :owner WHERE id = :id RETURNING id", { replacements: { owner: f.other.id, id: f.draft.id }, type: QueryTypes.SELECT, transaction: external });
            await waitBlocked(pid, first.pid, update); gates[0].release.resolve();
            if (rollback) await expect(a).rejects.toBe(error); else await a;
            expect(await update).toEqual(rollback ? [{ id: f.draft.id }] : []); await external.commit(); externalDone = true;
            vi.restoreAllMocks();
            if (rollback) {
                expect((await snapshot("item_draft", f.draft.id))?.seller_id).toBe(f.other.id);
                await expectNotFound(run(f)); await run(f, f.draft.id, f.other.id);
            }
            expect(await snapshot("item_draft", f.draft.id)).toBeNull();
        } finally { gates.forEach(g => g.release.resolve()); await settledA; if (update) await Promise.allSettled([update]); if (!externalDone) await external.rollback(); }
    });
    it.each([false, true])("P09: 先行所有者変更のrollback=%s後にWHEREを再評価", async rollback => {
        const external = await competitor.transaction(), gates = gateReads(1);
        let a: Promise<void> | undefined, externalDone = false;
        try {
            const pid = await transactionPid(competitor, external);
            await competitor.query("UPDATE item_draft SET seller_id = :owner WHERE id = :id", { replacements: { owner: f.other.id, id: f.draft.id }, transaction: external });
            a = run(f); const started = await waitForGate(gates[0].started.promise, a);
            await waitBlocked(started.pid, pid, a);
            if (rollback) await external.rollback(); else await external.commit(); externalDone = true;
            await waitForGate(gates[0].entered.promise, a); gates[0].release.resolve();
            if (rollback) { await a; expect(await snapshot("item_draft", f.draft.id)).toBeNull(); }
            else { await expectNotFound(a); expect((await snapshot("item_draft", f.draft.id))?.seller_id).toBe(f.other.id); }
        } finally { gates.forEach(g => g.release.resolve()); if (!externalDone) await external.rollback(); if (a) await Promise.allSettled([a]); }
    });
    it("P10: 所有権不一致は先行ロック保持中にも404で終了", async () => {
        const gates = gateReads(), a = run(f), settledA = Promise.allSettled([a]); let b: Promise<void> | undefined;
        try {
            await waitForGate(gates[0].entered.promise, a); b = run(f, f.draft.id, f.other.id);
            await waitForGate(gates[1].entered.promise, b); gates[1].release.resolve(); await expectNotFound(b);
            expect(await snapshot("item_draft", f.draft.id)).not.toBeNull(); gates[0].release.resolve(); await a;
        } finally { gates.forEach(g => g.release.resolve()); await settledA; if (b) await Promise.allSettled([b]); }
    });
});
