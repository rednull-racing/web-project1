import "../../../../fixtures/itemDraft/convertItemDraftVideo/databaseSetup.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    ItemDraft,
    protectedSnapshot,
    seed,
    snapshot,
} from "../../../../fixtures/itemDraft/convertItemDraftVideo/databaseFixtures.js";
import type { DbFixture } from "../../../../fixtures/itemDraft/convertItemDraftVideo/databaseFixtures.js";
import { AppError } from "../../../../../src/errors.js";
import { convertItemDraftVideoUseCase as run } from "../../../../../src/usecases/itemDraft/convertItemDraftVideo.js";

const mocks = vi.hoisted(() => ({
    convert: vi.fn<typeof import("../../../../../src/utils/itemDraftVideoConversion.js").convertItemDraftVideo>(),
}));
vi.mock("../../../../../src/utils/itemDraftVideoConversion.js", () => ({ convertItemDraftVideo: mocks.convert }));

const result = { convertedUrl: "https://media.test/current/index.m3u8", duration: 42 };
const params = (fixture: DbFixture) => ({ userId: fixture.owner.id, itemDraftId: fixture.draft.id });
const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
const settled = (task: Promise<void>) =>
    task.then(
        () => ({ success: true as const }),
        (error: unknown) => ({ success: false as const, error }),
    );
const waitEntered = async (gate: Promise<void>, task: ReturnType<typeof settled>) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            gate,
            task.then((outcome) => {
                throw new Error("処理がgate到達前に終了しました", { cause: outcome });
            }),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error("gate到達期限超過")), 5000);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
};
const withoutUpdatedAt = (row: Record<string, unknown> | null) => {
    if (!row) throw new Error("Expected persisted row");
    const { updatedAt, ...data } = row;
    expect(updatedAt).toBeInstanceOf(Date);
    return data;
};
const expectCancelled = (outcome: Awaited<ReturnType<typeof settled>>) => {
    expect(outcome.success).toBe(false);
    if (outcome.success) throw new Error("Expected cancelled request");
    expect(outcome.error).toBeInstanceOf(AppError);
    expect(outcome.error).toMatchObject({ code: "VIDEO_CONVERSION_CANCELLED", statusCode: 409 });
};

beforeEach(() => {
    mocks.convert.mockReset();
    mocks.convert.mockResolvedValue({ ...result });
});

// HTTP/schemaを介さず実usecase・service・Model・transactionを接続し、外部変換だけを遮断する。
describe("動画変換usecaseと実DBの状態遷移・認可", () => {
    it.each(["original", "processing", "converted", "failed", null])(
        "I01: 元状態%sを再変換しprocessingのcommit後に変換、convertedだけを保存する",
        async (video_status) => {
            const fixture = await seed();
            await fixture.draft.update({ video_status });
            const before = withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id));
            const protectedBefore = await protectedSnapshot(fixture);
            mocks.convert.mockImplementationOnce(async (input) => {
                expect(input).toEqual({
                    ...params(fixture),
                    originalUrl: fixture.originalUrl,
                    signal: expect.any(AbortSignal),
                });
                expect(input.signal.aborted).toBe(false);
                expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
                    ...before,
                    video_status: "processing",
                });
                return { ...result };
            });
            await expect(run(params(fixture))).resolves.toBeUndefined();
            expect(mocks.convert).toHaveBeenCalledTimes(1);
            expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
                ...before,
                video_status: "converted",
                converted_url: result.convertedUrl,
                duration: 42,
            });
            expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
            // 逐次再送も新しい変換を実行し、終了済み要求のsignalを再利用しない。
            await run(params(fixture));
            expect(mocks.convert).toHaveBeenCalledTimes(2);
            expect(mocks.convert.mock.calls[1][0].signal).not.toBe(mocks.convert.mock.calls[0][0].signal);
            expect(mocks.convert.mock.calls[1][0].signal.aborted).toBe(false);
        },
    );

    it.each([17, null])("I02: 変換失敗はfailed・URL null・duration=%s維持、再試行は成功する", async (duration) => {
        const fixture = await seed();
        await fixture.draft.update({ duration });
        const before = withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id));
        const protectedBefore = await protectedSnapshot(fixture);
        const error = new Error("conversion failed");
        mocks.convert.mockRejectedValueOnce(error);
        await expect(run(params(fixture))).rejects.toBe(error);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "failed",
            converted_url: null,
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
        await run(params(fixture));
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "converted",
            converted_url: result.convertedUrl,
            duration: 42,
        });
    });

    it.each(["foreign-user", "foreign-draft", "ownerless", "missing"] as const)(
        "I03: %sを404で拒否し変換せず全行を保持する",
        async (kind) => {
            const fixture = await seed();
            const missing = await ItemDraft.create({ seller_id: fixture.owner.id });
            await missing.destroy();
            const target = {
                "foreign-user": { userId: fixture.other.id, itemDraftId: fixture.draft.id },
                "foreign-draft": { userId: fixture.owner.id, itemDraftId: fixture.otherDraft.id },
                ownerless: { userId: fixture.owner.id, itemDraftId: fixture.ownerlessDraft.id },
                missing: { userId: fixture.owner.id, itemDraftId: missing.id },
            }[kind];
            const before = await snapshot("item_draft", fixture.draft.id);
            const protectedBefore = await protectedSnapshot(fixture);
            const outcome = await settled(run(target));
            expect(outcome.success).toBe(false);
            if (outcome.success) throw new Error("Expected authorization rejection");
            expect(outcome.error).toBeInstanceOf(AppError);
            expect(outcome.error).toMatchObject({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 });
            expect(mocks.convert).not.toHaveBeenCalled();
            expect(await snapshot("item_draft", fixture.draft.id)).toEqual(before);
            expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
            expect(await snapshot("item_draft", missing.id)).toBeNull();
        },
    );

    it.each([null, ""])("I04: 元URL=%sは400、processingも保存せず変換しない", async (original_url) => {
        const fixture = await seed();
        await fixture.draft.update({ original_url });
        const before = await snapshot("item_draft", fixture.draft.id);
        const protectedBefore = await protectedSnapshot(fixture);
        await expect(run(params(fixture))).rejects.toMatchObject({ code: "ORIGINAL_URL_NOT_FOUND", statusCode: 400 });
        expect(mocks.convert).not.toHaveBeenCalled();
        expect(await snapshot("item_draft", fixture.draft.id)).toEqual(before);
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it.each([false, true])("I05: 元URL差替え後、旧変換の失敗=%sでも成功・failedを書き込まない", async (fail) => {
        const fixture = await seed();
        const protectedBefore = await protectedSnapshot(fixture);
        const error = new Error("old conversion failed");
        let changed: Record<string, unknown> | null = null;
        mocks.convert.mockImplementationOnce(async () => {
            await fixture.draft.update({ original_url: "https://media.test/replaced.mp4", video_status: "original" });
            changed = await snapshot("item_draft", fixture.draft.id);
            if (fail) throw error;
            return { ...result };
        });
        const outcome = await settled(run(params(fixture)));
        if (fail) {
            expect(outcome.success).toBe(false);
            if (outcome.success) throw new Error("Expected failure");
            expect(outcome.error).toBeInstanceOf(AggregateError);
            expect((outcome.error as AggregateError).errors).toEqual([
                error,
                expect.objectContaining({ code: "VIDEO_CONVERSION_CANCELLED", statusCode: 409 }),
            ]);
        } else expectCancelled(outcome);
        expect(await snapshot("item_draft", fixture.draft.id)).toEqual(changed);
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it.each(["owner-changed", "deleted"] as const)("I11: 変換中に%sとなった行の最終認可を保持する", async (kind) => {
        const fixture = await seed();
        const protectedBefore = await protectedSnapshot(fixture);
        let changed: Record<string, unknown> | null = null;
        mocks.convert.mockImplementationOnce(async () => {
            if (kind === "owner-changed") await fixture.draft.update({ seller_id: fixture.other.id });
            else await fixture.draft.destroy();
            changed = await snapshot("item_draft", fixture.draft.id);
            return { ...result };
        });
        const outcome = await settled(run(params(fixture)));
        expect(outcome.success).toBe(false);
        if (outcome.success) throw new Error("Expected authorization failure");
        expect(outcome.error).toBeInstanceOf(AggregateError);
        expect((outcome.error as AggregateError).errors).toEqual([
            expect.objectContaining({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 }),
            expect.objectContaining({ code: "ITEM_DRAFT_NOT_FOUND", statusCode: 404 }),
        ]);
        expect(await snapshot("item_draft", fixture.draft.id)).toEqual(changed);
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });
});

describe("動画変換usecaseの要求差替えと実DB保存抑止", () => {
    it("I06: 旧変換を中断し終了回収後に新要求を開始、旧結果を保存しない", async () => {
        const fixture = await seed();
        const before = withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id));
        const protectedBefore = await protectedSnapshot(fixture);
        const entered = deferred();
        const release = deferred();
        let oldSignal: AbortSignal | undefined;
        mocks.convert.mockImplementationOnce(async ({ signal }) => {
            oldSignal = signal;
            entered.resolve();
            await release.promise;
            return { convertedUrl: "https://media.test/stale.m3u8", duration: 99 };
        });
        const first = settled(run(params(fixture)));
        let second: ReturnType<typeof settled> | undefined;
        try {
            await waitEntered(entered.promise, first);
            second = settled(run(params(fixture)));
            expect(oldSignal?.aborted).toBe(true);
            expect(mocks.convert).toHaveBeenCalledTimes(1);
            expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
                ...before,
                video_status: "processing",
            });
        } finally {
            release.resolve();
            await Promise.allSettled([first, ...(second ? [second] : [])]);
        }
        expectCancelled(await first);
        expect(await second).toEqual({ success: true });
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "converted",
            converted_url: result.convertedUrl,
            duration: 42,
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });

    it("I07: 旧終了待ちに3要求が到達すると中間要求は変換せず最後だけ保存する", async () => {
        const fixture = await seed();
        const before = withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id));
        const entered = deferred();
        const release = deferred();
        mocks.convert.mockImplementationOnce(async ({ signal }) => {
            entered.resolve();
            await release.promise;
            signal.throwIfAborted();
            return { ...result };
        });
        const first = settled(run(params(fixture)));
        let second: ReturnType<typeof settled> | undefined;
        let third: ReturnType<typeof settled> | undefined;
        try {
            await waitEntered(entered.promise, first);
            second = settled(run(params(fixture)));
            third = settled(run(params(fixture)));
            expect(mocks.convert).toHaveBeenCalledTimes(1);
        } finally {
            release.resolve();
            await Promise.allSettled([first, ...(second ? [second] : []), ...(third ? [third] : [])]);
        }
        expectCancelled(await first);
        if (!second || !third) throw new Error("Expected all requests to start");
        expectCancelled(await second);
        expect(await third).toEqual({ success: true });
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "converted",
            converted_url: result.convertedUrl,
            duration: 42,
        });
    });

    it("I08: 別IDは独立、他人による同じ下書きIDの要求は所有者の変換を中断しない", async () => {
        const fixture = await seed();
        const entered = deferred();
        const release = deferred();
        let oldSignal: AbortSignal | undefined;
        const otherBefore = await snapshot("item_draft", fixture.otherDraft.id);
        const ownerlessBefore = await snapshot("item_draft", fixture.ownerlessDraft.id);
        mocks.convert.mockImplementationOnce(async ({ signal }) => {
            oldSignal = signal;
            entered.resolve();
            await release.promise;
            return { ...result };
        });
        const first = settled(run(params(fixture)));
        try {
            await waitEntered(entered.promise, first);
            await expect(run({ ...params(fixture), userId: fixture.other.id })).rejects.toMatchObject({
                code: "ITEM_DRAFT_NOT_FOUND",
                statusCode: 404,
            });
            expect(oldSignal?.aborted).toBe(false);
            await run({ userId: fixture.owner.id, itemDraftId: fixture.sameOwnerDraft.id });
            expect(oldSignal?.aborted).toBe(false);
            expect(mocks.convert).toHaveBeenCalledTimes(2);
            expect(mocks.convert.mock.calls[1][0]).toMatchObject({
                userId: fixture.owner.id,
                itemDraftId: fixture.sameOwnerDraft.id,
            });
            expect(await snapshot("item_draft", fixture.sameOwnerDraft.id)).toMatchObject({
                video_status: "converted",
                duration: 42,
                converted_url: result.convertedUrl,
            });
        } finally {
            release.resolve();
            await first;
        }
        expect(await first).toEqual({ success: true });
        expect(await snapshot("item_draft", fixture.otherDraft.id)).toEqual(otherBefore);
        expect(await snapshot("item_draft", fixture.ownerlessDraft.id)).toEqual(ownerlessBefore);
    });
});

describe("動画変換usecaseの実UPDATE後rollback・補償更新・再試行", () => {
    it("I09: 開始UPDATE後のcallback障害で全列rollback、変換未実行、再試行で成功する", async () => {
        const fixture = await seed();
        const before = await snapshot("item_draft", fixture.draft.id);
        const protectedBefore = await protectedSnapshot(fixture);
        const error = new Error("after processing SQL");
        let injected = false;
        ItemDraft.addHook("afterUpdate", "conversionBeginFailure", async (row, options) => {
            if (row.get("id") !== fixture.draft.id || row.get("video_status") !== "processing") return;
            injected = true;
            if (!options.transaction) throw new Error("Expected usecase transaction");
            expect((await snapshot("item_draft", fixture.draft.id, options.transaction))?.video_status).toBe(
                "processing",
            );
            expect(await snapshot("item_draft", fixture.draft.id)).toEqual(before);
            throw error;
        });
        try {
            await expect(run(params(fixture))).rejects.toBe(error);
        } finally {
            ItemDraft.removeHook("afterUpdate", "conversionBeginFailure");
        }
        expect(injected).toBe(true);
        expect(mocks.convert).not.toHaveBeenCalled();
        expect(await snapshot("item_draft", fixture.draft.id)).toEqual(before);
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
        await run(params(fixture));
        expect(mocks.convert).toHaveBeenCalledTimes(1);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...withoutUpdatedAt(before),
            video_status: "converted",
            converted_url: result.convertedUrl,
            duration: 42,
        });
    });

    it("I10: 成功UPDATE後のcallback障害はrollbackしfailed補償、duration保持後の再試行は成功する", async () => {
        const fixture = await seed();
        const before = withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id));
        const protectedBefore = await protectedSnapshot(fixture);
        const error = new Error("after converted SQL");
        let injected = false;
        ItemDraft.addHook("afterUpdate", "conversionFinishFailure", async (row, options) => {
            if (row.get("id") !== fixture.draft.id || row.get("video_status") !== "converted") return;
            injected = true;
            if (!options.transaction) throw new Error("Expected usecase transaction");
            expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id, options.transaction))).toEqual({
                ...before,
                video_status: "converted",
                converted_url: result.convertedUrl,
                duration: 42,
            });
            expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
                ...before,
                video_status: "processing",
            });
            throw error;
        });
        try {
            await expect(run(params(fixture))).rejects.toBe(error);
        } finally {
            ItemDraft.removeHook("afterUpdate", "conversionFinishFailure");
        }
        expect(injected).toBe(true);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "failed",
            converted_url: null,
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
        await run(params(fixture));
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "converted",
            converted_url: result.convertedUrl,
            duration: 42,
        });
    });

    it("I12: 完了UPDATE後の新要求は旧callbackをrollbackさせ、旧完了回収後に新結果だけ保存する", async () => {
        const fixture = await seed();
        const before = withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id));
        const protectedBefore = await protectedSnapshot(fixture);
        const entered = deferred();
        const release = deferred();
        let injected = false;
        ItemDraft.addHook("afterUpdate", "conversionFinishAbort", async (row, options) => {
            if (row.get("id") !== fixture.draft.id || row.get("video_status") !== "converted" || injected) return;
            injected = true;
            if (!options.transaction) throw new Error("Expected usecase transaction");
            expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id, options.transaction))).toEqual({
                ...before,
                video_status: "converted",
                converted_url: result.convertedUrl,
                duration: 42,
            });
            entered.resolve();
            await release.promise;
        });
        const first = settled(run(params(fixture)));
        let second: ReturnType<typeof settled> | undefined;
        try {
            await waitEntered(entered.promise, first);
            mocks.convert.mockResolvedValueOnce({ convertedUrl: "https://media.test/latest/index.m3u8", duration: 23 });
            second = settled(run(params(fixture)));
            expect(mocks.convert.mock.calls[0][0].signal.aborted).toBe(true);
            expect(mocks.convert).toHaveBeenCalledTimes(1);
            expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
                ...before,
                video_status: "processing",
            });
        } finally {
            release.resolve();
            await Promise.allSettled([first, ...(second ? [second] : [])]);
            ItemDraft.removeHook("afterUpdate", "conversionFinishAbort");
        }
        expect(injected).toBe(true);
        expectCancelled(await first);
        expect(await second).toEqual({ success: true });
        expect(mocks.convert).toHaveBeenCalledTimes(2);
        expect(withoutUpdatedAt(await snapshot("item_draft", fixture.draft.id))).toEqual({
            ...before,
            video_status: "converted",
            converted_url: "https://media.test/latest/index.m3u8",
            duration: 23,
        });
        expect(await protectedSnapshot(fixture)).toEqual(protectedBefore);
    });
});
