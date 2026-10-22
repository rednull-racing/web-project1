import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { updateItemDraftVideo } from "../../services/itemDraft/command.js";
import { getMyItemDraft } from "../../services/itemDraft/query.js";
import type { UpdateItemDraftVideoData } from "../../types/serviceType/itemDraft.js";
import { convertItemDraftVideo } from "../../utils/itemDraftVideoConversion.js";

type Params = { userId: number; itemDraftId: number };
type Job = { controller: AbortController; completion: Promise<void> };

// 現行の単一Node.jsプロセス内で要求を差し替える。所有者別にし、他人のIDによる中断を防ぐ。
const jobs = new Map<string, Job>();

const cancelled = () => new AppError("VIDEO_CONVERSION_CANCELLED", 409);

const saveCurrentVideo = async ({
    userId,
    itemDraftId,
    originalUrl,
    signal,
    data,
}: Params & { originalUrl: string; signal: AbortSignal; data: UpdateItemDraftVideoData }): Promise<void> => {
    await sequelize.transaction(async (transaction) => {
        signal.throwIfAborted();
        const itemDraft = await getMyItemDraft({ userId, itemDraftId, transaction });
        signal.throwIfAborted();
        if (!itemDraft) throw new AppError("ITEM_DRAFT_NOT_FOUND", 404);
        if (itemDraft.original_url !== originalUrl) throw cancelled();

        await updateItemDraftVideo({ itemDraft, data, transaction });
        signal.throwIfAborted();
    });
};

const runConversion = async (params: Params, signal: AbortSignal): Promise<void> => {
    const originalUrl = await sequelize.transaction(async (transaction) => {
        signal.throwIfAborted();
        const itemDraft = await getMyItemDraft({ ...params, transaction });
        signal.throwIfAborted();
        if (!itemDraft) throw new AppError("ITEM_DRAFT_NOT_FOUND", 404);
        if (!itemDraft.original_url) throw new AppError("ORIGINAL_URL_NOT_FOUND", 400);

        await updateItemDraftVideo({ itemDraft, data: { video_status: "processing" }, transaction });
        signal.throwIfAborted();
        return itemDraft.original_url;
    });

    try {
        signal.throwIfAborted();
        const result = await convertItemDraftVideo({ ...params, originalUrl, signal });
        await saveCurrentVideo({
            ...params,
            originalUrl,
            signal,
            data: { video_status: "converted", converted_url: result.convertedUrl, duration: result.duration },
        });
    } catch (error) {
        if (signal.aborted || (error instanceof AppError && error.code === "VIDEO_CONVERSION_CANCELLED")) {
            throw error;
        }

        try {
            await saveCurrentVideo({
                ...params,
                originalUrl,
                signal,
                data: { video_status: "failed", converted_url: null },
            });
        } catch (saveError) {
            throw new AggregateError([error, saveError], "Video conversion and failure recording failed");
        }
        throw error;
    }
};

// PATCH /item-draft/:id/convert
// summary: 下書き商品動画HLS変換
// page: /upload/[id]
export const convertItemDraftVideoUseCase = async (params: Params): Promise<void> => {
    const key = `${params.userId}:${params.itemDraftId}`;
    const previous = jobs.get(key);
    const controller = new AbortController();
    previous?.controller.abort(cancelled());

    const completion = (async () => {
        // 旧要求の失敗は旧要求の共通実行境界で処理する。終了・cleanupは新要求も待つ。
        await Promise.allSettled(previous ? [previous.completion] : []);
        controller.signal.throwIfAborted();
        await runConversion(params, controller.signal);
    })();
    const job: Job = { controller, completion };
    jobs.set(key, job);

    try {
        await completion;
    } finally {
        if (jobs.get(key) === job) jobs.delete(key);
    }
};
