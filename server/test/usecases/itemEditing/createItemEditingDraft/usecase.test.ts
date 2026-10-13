import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { getMyItemDraft } from "../../../../src/services/itemDraft/query.js";
import type { createItemEditingDraft } from "../../../../src/services/itemEditing/command.js";
import type { deleteItemDraft } from "../../../../src/services/itemDraft/command.js";
import { copyVariants, deferred, expectAppError, makeData, makeDraft, waitForGate } from "./fixtures.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn<(callback: (t: Transaction) => Promise<number>) => Promise<number>>(),
    get: vi.fn<typeof getMyItemDraft>(),
    create: vi.fn<typeof createItemEditingDraft>(),
    delete: vi.fn<typeof deleteItemDraft>(),
}));
vi.mock("../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../src/services/itemDraft/query.js", () => ({ getMyItemDraft: mocks.get }));
vi.mock("../../../../src/services/itemDraft/command.js", () => ({ deleteItemDraft: mocks.delete }));
vi.mock("../../../../src/services/itemEditing/command.js", () => ({ createItemEditingDraft: mocks.create }));
import { createItemEditingDraftUseCase } from "../../../../src/usecases/itemEditing/createItemEditingDraft.js";

const t = { LOCK: { UPDATE: "UPDATE" } } as Transaction;
let draft: NonNullable<Awaited<ReturnType<typeof getMyItemDraft>>>;
const editing = { id: 456 } as Awaited<ReturnType<typeof createItemEditingDraft>>;
const run = () => createItemEditingDraftUseCase({ userId: 7, itemDraftId: 11 });
beforeEach(() => {
    vi.resetAllMocks();
    draft = makeDraft() as unknown as typeof draft;
    mocks.transaction.mockImplementation(async (callback) => callback(t));
    mocks.get.mockResolvedValue(draft);
    mocks.create.mockResolvedValue(editing);
    mocks.delete.mockResolvedValue(undefined);
});

describe("P0: usecaseのコピー・所有権・同一transaction", () => {
    it("N01 N02 T01: 全項目をコピーし取得・作成・削除の順で新規IDを返す", async () => {
        expect(await run()).toBe(456);
        expect(mocks.transaction).toHaveBeenCalledOnce();
        expect(mocks.get).toHaveBeenCalledExactlyOnceWith({ userId: 7, itemDraftId: 11, transaction: t });
        expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ data: makeData(), transaction: t });
        expect(mocks.delete).toHaveBeenCalledExactlyOnceWith({ itemDraft: draft, transaction: t });
        expect(mocks.delete.mock.calls[0][0].itemDraft).toBe(draft);
        expect(mocks.get.mock.calls[0][0].transaction).toBe(t);
        expect(mocks.delete.mock.calls[0][0].transaction).toBe(t);
        expect(mocks.create.mock.calls[0][0].transaction).toBe(t);
        expect(mocks.create.mock.calls[0][0].data.image_url).toBe(draft.image_url);
        expect(mocks.create.mock.calls[0][0].data.attributes).toBe(draft.attributes);
        expect(mocks.get.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.transaction.mock.invocationCallOrder[0]);
        expect(mocks.get.mock.invocationCallOrder[0]).toBeLessThan(mocks.create.mock.invocationCallOrder[0]);
        expect(mocks.create.mock.invocationCallOrder[0]).toBeLessThan(mocks.delete.mock.invocationCallOrder[0]);
    });
    it("N02: 取得値のseller_idではなく認証IDを作成dataへ設定する", async () => {
        // 実serviceはwhereで認可する。ここではコピー元の所有者値を採用しない責務だけを確認する。
        draft.seller_id = 8;
        await run();
        expect(mocks.create.mock.calls[0][0].data).toEqual(makeData());
    });
    it("E01: 取得nullは404となり作成・削除を呼ばない", async () => {
        mocks.get.mockResolvedValue(null);
        await expectAppError(run());
        expect(mocks.create).not.toHaveBeenCalled();
        expect(mocks.delete).not.toHaveBeenCalled();
    });
    it.each(["transaction", "get", "create", "delete"] as const)(
        "E03 E04 E05 E06: %sの元例外を伝播して後続を止める",
        async (step) => {
            const error = new Error(step);
            mocks[step].mockRejectedValue(error);
            await expect(run()).rejects.toBe(error);
            if (step === "transaction") expect(mocks.get).not.toHaveBeenCalled();
            if (step === "transaction" || step === "get") expect(mocks.create).not.toHaveBeenCalled();
            if (step !== "delete") expect(mocks.delete).not.toHaveBeenCalled();
        },
    );
});

describe("P1: コピー値の境界と任意項目", () => {
    it.each(copyVariants)("$id: $nameを加工せずコピーする", async ({ values }) => {
        draft = makeDraft(values) as unknown as typeof draft;
        mocks.get.mockResolvedValue(draft);
        await run();
        expect(mocks.create.mock.calls[0][0].data).toEqual(makeData(values));
        expect(mocks.create.mock.calls[0][0].data.attributes).toBe(draft.attributes);
    });
});

describe("P0: awaitとtransaction完了待ち", () => {
    it.each(["get", "create", "delete", "commit"] as const)("T02: %s保留中は後続と成功返却がない", async (step) => {
        const entered = deferred<void>(),
            release = deferred<void>();
        let completed = false;
        if (step === "get")
            mocks.get.mockImplementation(async () => {
                entered.resolve();
                await release.promise;
                return draft;
            });
        if (step === "create")
            mocks.create.mockImplementation(async () => {
                entered.resolve();
                await release.promise;
                return editing;
            });
        if (step === "delete")
            mocks.delete.mockImplementation(async () => {
                entered.resolve();
                await release.promise;
            });
        if (step === "commit")
            mocks.transaction.mockImplementation(async (callback) => {
                const id = await callback(t);
                entered.resolve();
                await release.promise;
                return id;
            });
        const pending = run().then((id) => {
            completed = true;
            return id;
        });
        const settled = Promise.allSettled([pending]);
        try {
            await waitForGate(entered.promise, pending);
            expect(completed).toBe(false);
            if (step === "get") expect(mocks.create).not.toHaveBeenCalled();
            if (step === "get" || step === "create") expect(mocks.delete).not.toHaveBeenCalled();
        } finally {
            release.resolve();
            await settled;
        }
        expect(await pending).toBe(456);
    });
    it("E09: callback成功後のtransaction完了例外をそのまま伝播する（commit障害は模擬）", async () => {
        const error = new Error("commit boundary");
        mocks.transaction.mockImplementation(async (callback) => {
            await callback(t);
            throw error;
        });
        await expect(run()).rejects.toBe(error);
        expect(mocks.delete).toHaveBeenCalledOnce();
    });
});
