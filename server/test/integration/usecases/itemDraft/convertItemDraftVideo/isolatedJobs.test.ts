import type { Transaction } from "sequelize";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deferred } from "../../../../fixtures/itemDraft/convertItemDraftVideo/httpFixtures.js";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    draftGet: vi.fn(),
    draftUpdate: vi.fn(),
    draftConvert: vi.fn(),
    editingGet: vi.fn(),
    editingUpdate: vi.fn(),
    editingConvert: vi.fn(),
}));
vi.mock("../../../../../src/db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../../../src/services/itemDraft/query.js", () => ({ getMyItemDraft: mocks.draftGet }));
vi.mock("../../../../../src/services/itemDraft/command.js", () => ({ updateItemDraftVideo: mocks.draftUpdate }));
vi.mock("../../../../../src/utils/itemDraftVideoConversion.js", () => ({ convertItemDraftVideo: mocks.draftConvert }));
vi.mock("../../../../../src/services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.editingGet }));
vi.mock("../../../../../src/services/itemEditing/command.js", () => ({ updateItemEditingVideo: mocks.editingUpdate }));
vi.mock("../../../../../src/utils/itemEditingVideoConversion.js", () => ({ convertItemEditingVideo: mocks.editingConvert }));

import { convertItemDraftVideoUseCase } from "../../../../../src/usecases/itemDraft/convertItemDraftVideo.js";
import { convertItemEditingVideoUseCase } from "../../../../../src/usecases/itemEditing/convertItemEditingVideo.js";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation((callback: (transaction: Transaction) => Promise<unknown>) =>
        callback({ LOCK: { UPDATE: "UPDATE" } } as Transaction),
    );
    mocks.draftGet.mockImplementation(async () => ({ id: 19, original_url: "https://media.test/draft" }));
    mocks.editingGet.mockImplementation(async () => ({ id: 19, original_url: "https://media.test/editing" }));
    mocks.draftUpdate.mockResolvedValue(undefined);
    mocks.editingUpdate.mockResolvedValue(undefined);
});

describe("P0: 下書きと編集中の実usecase接続・ジョブ分離（DB/変換境界モック）", () => {
    it("U19: 同じ認証所有者・行IDでも互いを中断せず別URL・秒数をそれぞれのserviceへ保存する", async () => {
        const editingEntered = deferred<void>(), draftEntered = deferred<void>();
        const editingRelease = deferred<void>(), draftRelease = deferred<void>();
        let editingSignal: AbortSignal | undefined, draftSignal: AbortSignal | undefined;
        mocks.editingConvert.mockImplementation(async ({ signal }: { signal: AbortSignal }) => {
            editingSignal = signal;
            editingEntered.resolve();
            await editingRelease.promise;
            signal.throwIfAborted();
            return { convertedUrl: "https://media.test/converted-editing", duration: 31 };
        });
        mocks.draftConvert.mockImplementation(async ({ signal }: { signal: AbortSignal }) => {
            draftSignal = signal;
            draftEntered.resolve();
            await draftRelease.promise;
            signal.throwIfAborted();
            return { convertedUrl: "https://media.test/converted-draft", duration: 17 };
        });
        const editing = convertItemEditingVideoUseCase({ userId: 7, itemEditingId: 19 });
        const editingOutcome = editing.then(() => undefined, (error: unknown) => error);
        let draftOutcome: Promise<unknown> | undefined;
        try {
            await Promise.race([editingEntered.promise, editing.then(() => { throw new Error("編集変換に到達しませんでした"); })]);
            const draft = convertItemDraftVideoUseCase({ userId: 7, itemDraftId: 19 });
            draftOutcome = draft.then(() => undefined, (error: unknown) => error);
            await Promise.race([draftEntered.promise, draft.then(() => { throw new Error("下書き変換に到達しませんでした"); })]);
            expect(editingSignal?.aborted).toBe(false);
            expect(draftSignal?.aborted).toBe(false);
            expect(draftSignal).not.toBe(editingSignal);
            draftRelease.resolve();
            expect(await draftOutcome).toBeUndefined();
            expect(editingSignal?.aborted).toBe(false);
            expect(mocks.editingUpdate).toHaveBeenCalledTimes(1);
            expect(mocks.draftUpdate.mock.calls.map(([arg]) => arg.data)).toEqual([
                { video_status: "processing" },
                { video_status: "converted", converted_url: "https://media.test/converted-draft", duration: 17 },
            ]);
        } finally {
            draftRelease.resolve();
            editingRelease.resolve();
            expect(await editingOutcome).toBeUndefined();
            if (draftOutcome) expect(await draftOutcome).toBeUndefined();
        }
        expect(mocks.editingUpdate.mock.calls.map(([arg]) => arg.data)).toEqual([
            { video_status: "processing" },
            { video_status: "converted", converted_url: "https://media.test/converted-editing", duration: 31 },
        ]);
        expect(mocks.draftConvert).toHaveBeenCalledExactlyOnceWith({
            userId: 7, itemDraftId: 19, originalUrl: "https://media.test/draft", signal: draftSignal,
        });
        expect(mocks.editingConvert).toHaveBeenCalledExactlyOnceWith({
            userId: 7, itemEditingId: 19, originalUrl: "https://media.test/editing", signal: editingSignal,
        });
    });
});
