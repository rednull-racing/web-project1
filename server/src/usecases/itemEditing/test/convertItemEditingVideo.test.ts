import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transaction } from "sequelize";

const mocks = vi.hoisted(() => ({
    transaction: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    convert: vi.fn(),
}));
vi.mock("../../../db.js", () => ({ default: { transaction: mocks.transaction } }));
vi.mock("../../../services/itemEditing/query.js", () => ({ getMyItemEditing: mocks.get }));
vi.mock("../../../services/itemEditing/command.js", () => ({ updateItemEditingVideo: mocks.update }));
vi.mock("../../../utils/itemEditingVideoConversion.js", () => ({ convertItemEditingVideo: mocks.convert }));

import { convertItemEditingVideoUseCase as run } from "../convertItemEditingVideo.js";

const params = { userId: 7, itemEditingId: 19 };
const source = "https://media.test/original";
const result = { convertedUrl: "https://media.test/converted", duration: 23 };
const row = () => ({ id: 19, seller_id: 7, original_url: source, video_status: "original", duration: 42 });
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((yes, no) => {
        resolve = yes;
        reject = no;
    });
    return { promise, resolve, reject };
};
const makeTransaction = () => ({ LOCK: { UPDATE: "UPDATE" } }) as Transaction;

beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(async (callback: (t: Transaction) => Promise<unknown>) =>
        callback(makeTransaction()),
    );
    mocks.get.mockImplementation(async () => row());
    mocks.update.mockResolvedValue(undefined);
    mocks.convert.mockResolvedValue({ ...result });
});
afterEach(() => vi.restoreAllMocks());

describe("convertItemEditingVideo usecase P0 状態・停止・待機", () => {
    it.each(["original", "processing", "converted", "failed", null])(
        "U01 %sからprocessingとconvertedのみ保存する",
        async (status) => {
            const first = { ...row(), video_status: status };
            const latest = { ...row(), video_status: "processing" };
            mocks.get.mockResolvedValueOnce(first).mockResolvedValueOnce(latest);
            await expect(run(params)).resolves.toBeUndefined();
            expect(mocks.get).toHaveBeenCalledTimes(2);
            const firstTransaction = mocks.get.mock.calls[0][0].transaction;
            const lastTransaction = mocks.get.mock.calls[1][0].transaction;
            expect(mocks.get.mock.calls[0][0]).toEqual({ ...params, transaction: firstTransaction });
            expect(mocks.update.mock.calls).toEqual([
                [{ itemEditing: first, data: { video_status: "processing" }, transaction: firstTransaction }],
                [
                    {
                        itemEditing: latest,
                        data: { video_status: "converted", converted_url: result.convertedUrl, duration: 23 },
                        transaction: lastTransaction,
                    },
                ],
            ]);
            expect(mocks.update.mock.calls[0][0].itemEditing).toBe(first);
            expect(mocks.update.mock.calls[1][0].itemEditing).toBe(latest);
            expect(mocks.convert).toHaveBeenCalledExactlyOnceWith({
                ...params,
                originalUrl: source,
                signal: expect.any(AbortSignal),
            });
        },
    );

    it("U02 所有者限定検索nullは404で更新・変換しない", async () => {
        mocks.get.mockResolvedValue(null);
        await expect(run(params)).rejects.toMatchObject({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 });
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.convert).not.toHaveBeenCalled();
    });

    it.each([null, ""])("U03 元動画%sは400で更新しない", async (url) => {
        mocks.get.mockResolvedValue({ ...row(), original_url: url });
        await expect(run(params)).rejects.toMatchObject({ code: "ORIGINAL_URL_NOT_FOUND", statusCode: 400 });
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.convert).not.toHaveBeenCalled();
    });

    it("U04 変換失敗はfailed・URL nullのみ保存して元例外を伝播", async () => {
        const error = new Error("download failure");
        mocks.convert.mockRejectedValue(error);
        await expect(run(params)).rejects.toBe(error);
        expect(mocks.update.mock.calls.map(([p]) => p.data)).toEqual([
            { video_status: "processing" },
            { video_status: "failed", converted_url: null },
        ]);
    });

    it("U05 最終取得の元動画変更は中断409で旧結果・failedを保存しない", async () => {
        mocks.get.mockResolvedValueOnce(row()).mockResolvedValueOnce({ ...row(), original_url: "new-source" });
        await expect(run(params)).rejects.toMatchObject({ code: "VIDEO_CONVERSION_CANCELLED", statusCode: 409 });
        expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    it("U06 最終取得の所有者変更・削除で対象行を復元しない", async () => {
        mocks.get.mockResolvedValueOnce(row()).mockResolvedValue(null);
        const outcome = await run(params).catch((error: unknown) => error);
        expect(outcome).toBeInstanceOf(AggregateError);
        expect((outcome as AggregateError).errors).toEqual([
            expect.objectContaining({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 }),
            expect.objectContaining({ code: "ITEM_EDITING_NOT_FOUND", statusCode: 404 }),
        ]);
        expect(mocks.update).toHaveBeenCalledTimes(1);
    });

    it("U07 変換と失敗記録の原因を両方保持する", async () => {
        const conversionError = new Error("conversion");
        const saveError = new Error("recording");
        mocks.convert.mockRejectedValue(conversionError);
        mocks.update.mockResolvedValueOnce(undefined).mockRejectedValueOnce(saveError);
        const outcome = await run(params).catch((error: unknown) => error);
        expect(outcome).toBeInstanceOf(AggregateError);
        expect((outcome as AggregateError).errors).toEqual([conversionError, saveError]);
    });

    it.each(["update", "transaction"])("U08 開始時%s失敗では変換を呼ばない", async (stage) => {
        const error = new Error(stage);
        if (stage === "update") mocks.update.mockRejectedValue(error);
        else mocks.transaction.mockRejectedValue(error);
        await expect(run(params)).rejects.toBe(error);
        expect(mocks.convert).not.toHaveBeenCalled();
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
    });

    it("U09 成功保存障害後はfailedを記録する", async () => {
        const error = new Error("final update");
        mocks.update.mockResolvedValueOnce(undefined).mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
        await expect(run(params)).rejects.toBe(error);
        expect(mocks.update.mock.calls.map(([p]) => p.data)).toEqual([
            { video_status: "processing" },
            { video_status: "converted", converted_url: result.convertedUrl, duration: 23 },
            { video_status: "failed", converted_url: null },
        ]);
    });

    it.each(["start", "finish"])("U10/U11 %sの外側transaction完了を待つ", async (stage) => {
        const entered = deferred<void>();
        const release = deferred<void>();
        let count = 0;
        mocks.transaction.mockImplementation(async (callback: (t: Transaction) => Promise<unknown>) => {
            const value = await callback(makeTransaction());
            count++;
            if (count === (stage === "start" ? 1 : 2)) {
                entered.resolve();
                await release.promise;
            }
            return value;
        });
        let settled = false;
        const task = run(params).finally(() => {
            settled = true;
        });
        try {
            await entered.promise;
            expect(settled).toBe(false);
            if (stage === "start") expect(mocks.convert).not.toHaveBeenCalled();
        } finally {
            release.resolve();
            await task;
        }
    });

    it("U17 失敗記録前に元URLが変わっても古いfailedを保存しない", async () => {
        const error = new Error("upload");
        mocks.convert.mockRejectedValue(error);
        mocks.get.mockResolvedValueOnce(row()).mockResolvedValueOnce({ ...row(), original_url: "new-source" });
        const outcome = await run(params).catch((reason: unknown) => reason);
        expect(outcome).toBeInstanceOf(AggregateError);
        expect((outcome as AggregateError).errors[0]).toBe(error);
        expect((outcome as AggregateError).errors[1]).toMatchObject({ code: "VIDEO_CONVERSION_CANCELLED" });
        expect(mocks.update).toHaveBeenCalledTimes(1);
    });
});

describe("convertItemEditingVideo usecase P0 要求差替え", () => {
    it.each([2, 3])("U12/U13 %i要求は旧処理回収後に最後だけ変換する", async (requests) => {
        const entered = deferred<void>();
        const aborted = deferred<void>();
        const cleanup = deferred<void>();
        let firstSignal: AbortSignal | undefined;
        mocks.convert.mockImplementationOnce(async ({ signal }: { signal: AbortSignal }) => {
            firstSignal = signal;
            entered.resolve();
            await new Promise<void>((resolve) =>
                signal.addEventListener(
                    "abort",
                    () => {
                        aborted.resolve();
                        resolve();
                    },
                    { once: true },
                ),
            );
            await cleanup.promise;
            signal.throwIfAborted();
        });
        const first = run(params);
        const firstOutcome = first.catch((error: unknown) => error);
        const others: Promise<unknown>[] = [];
        try {
            await entered.promise;
            for (let i = 1; i < requests; i++) others.push(run(params).catch((error: unknown) => error));
            await aborted.promise;
            expect(firstSignal?.aborted).toBe(true);
            expect(mocks.convert).toHaveBeenCalledTimes(1);
            expect(mocks.update).toHaveBeenCalledTimes(1);
        } finally {
            cleanup.resolve();
        }
        const outcomes = await Promise.all([firstOutcome, ...others]);
        expect(outcomes[0]).toMatchObject({ code: "VIDEO_CONVERSION_CANCELLED", statusCode: 409 });
        if (requests === 3) expect(outcomes[1]).toMatchObject({ code: "VIDEO_CONVERSION_CANCELLED" });
        expect(outcomes.at(-1)).toBeUndefined();
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(mocks.update.mock.calls.map(([p]) => p.data.video_status)).toEqual([
            "processing",
            "processing",
            "converted",
        ]);
    });

    it.each([
        { userId: 7, itemEditingId: 20 },
        { userId: 8, itemEditingId: 19 },
    ])("U14 別キー%jは所有者の進行中処理を中断しない", async (other) => {
        const entered = deferred<void>();
        const release = deferred<void>();
        let firstSignal: AbortSignal | undefined;
        mocks.convert.mockImplementationOnce(async ({ signal }: { signal: AbortSignal }) => {
            firstSignal = signal;
            entered.resolve();
            await release.promise;
            return { ...result };
        });
        const first = run(params);
        try {
            await entered.promise;
            await run(other);
            expect(firstSignal?.aborted).toBe(false);
            expect(mocks.convert).toHaveBeenCalledTimes(2);
            expect(mocks.convert.mock.calls[1][0]).toMatchObject(other);
        } finally {
            release.resolve();
            await first;
        }
    });

    it.each([false, true])("U15 失敗=%s後も同一IDを再変換できる", async (fail) => {
        if (fail) mocks.convert.mockRejectedValueOnce(new Error("first"));
        await run(params).catch(() => undefined);
        await run(params);
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(mocks.convert.mock.calls[1][0].signal.aborted).toBe(false);
    });

    it("U16 開始UPDATE待機中に中断した旧callbackは失敗してから新要求を始める", async () => {
        const entered = deferred<void>();
        const release = deferred<void>();
        mocks.update.mockImplementationOnce(async () => {
            entered.resolve();
            await release.promise;
        });
        const first = run(params).catch((error: unknown) => error);
        let second: Promise<void> | undefined;
        try {
            await entered.promise;
            second = run(params);
            expect(mocks.convert).not.toHaveBeenCalled();
        } finally {
            release.resolve();
        }
        expect(await first).toMatchObject({ code: "VIDEO_CONVERSION_CANCELLED" });
        await second;
        expect(mocks.convert).toHaveBeenCalledTimes(1);
    });

    it("U18 中断とcleanup失敗の両原因を保持し旧failedを保存しない", async () => {
        const entered = deferred<void>();
        const cleanupError = new Error("cleanup");
        mocks.convert.mockImplementationOnce(async ({ signal }: { signal: AbortSignal }) => {
            entered.resolve();
            await new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true }));
            throw new AggregateError([signal.reason, cleanupError], "cleanup after abort");
        });
        const first = run(params).catch((error: unknown) => error);
        await entered.promise;
        const second = run(params);
        const outcome = await first;
        await second;
        expect(outcome).toBeInstanceOf(AggregateError);
        expect((outcome as AggregateError).errors).toEqual([
            expect.objectContaining({ code: "VIDEO_CONVERSION_CANCELLED" }),
            cleanupError,
        ]);
        expect(mocks.update.mock.calls.map(([p]) => p.data.video_status)).toEqual([
            "processing",
            "processing",
            "converted",
        ]);
    });
});
