import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../errors.js";

const mocks = vi.hoisted(() => ({
    spawn: vi.fn(),
    mkdir: vi.fn(),
    readdir: vi.fn(),
    rm: vi.fn(),
    download: vi.fn(),
    upload: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:crypto", () => ({ randomUUID: () => "request-uuid" }));
vi.mock("node:fs", () => ({ default: { mkdirSync: mocks.mkdir, readdirSync: mocks.readdir, rmSync: mocks.rm } }));
vi.mock("../../infra/aws/s3.js", () => ({ publicS3Domain: "https://media.test" }));
vi.mock("../s3/videoConvert.js", () => ({ downloadVideoFromS3: mocks.download, uploadVideoToS3: mocks.upload }));
import { convertItemDraftVideo } from "../itemDraftVideoConversion.js";
import { convertItemEditingVideo } from "../itemEditingVideoConversion.js";

class ProcessFixture extends EventEmitter {
    stdout = new EventEmitter();
    kill = vi.fn(() => true);
}

const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
const originalFilePath = "tmp/item_draft_original_request-uuid";
const convertedDir = "tmp/item_draft_converted_request-uuid";
const keyPrefix = "video/converted/item-draft/7/23/request-uuid";
const makeParams = () => ({
    userId: 7,
    itemDraftId: 23,
    originalUrl: "https://media.test/video/original/source.mp4",
    signal: new AbortController().signal,
});
let children: ProcessFixture[];
let duration: string;

const finish = (child: ProcessFixture, output = "", code: number | null = 0) => {
    if (output) child.stdout.emit("data", Buffer.from(output));
    child.emit("close", code);
};
const expectCleanup = () => {
    expect(mocks.rm.mock.calls).toEqual([
        [originalFilePath, { force: true }],
        [convertedDir, { recursive: true, force: true }],
    ]);
};
const expectReleased = () => {
    expect(vi.getTimerCount()).toBe(0);
    for (const child of children) {
        expect(child.listenerCount("error")).toBe(0);
        expect(child.listenerCount("close")).toBe(0);
        expect(child.stdout.listenerCount("data")).toBe(0);
    }
};
const expectConversionError = async (promise: Promise<unknown>, code = "VIDEO_CONVERSION_FAILED", statusCode = 422) => {
    const error: unknown = await promise.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code, statusCode });
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    children = [];
    duration = "12.999\n";
    mocks.download.mockResolvedValue(undefined);
    mocks.upload.mockResolvedValue(undefined);
    mocks.readdir.mockReturnValue(["index.m3u8", "seg_000.ts", "unrelated.txt", "seg_001.ts"]);
    mocks.spawn.mockImplementation((command: string) => {
        const child = new ProcessFixture();
        children.push(child);
        Promise.resolve().then(() => finish(child, command === "ffprobe" ? duration : ""));
        return child;
    });
});
afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe("P0: V01 動画変換utilityの正常処理（child・fs・S3境界モック）", () => {
    it("V01: duration切捨て、HLS引数、segment先行公開と自作パスだけのcleanup", async () => {
        const params = makeParams();
        const remove = vi.spyOn(params.signal, "removeEventListener");
        expect(await convertItemDraftVideo(params)).toEqual({
            convertedUrl: `https://media.test/${keyPrefix}/index.m3u8`,
            duration: 12,
        });
        expect(mocks.download).toHaveBeenCalledExactlyOnceWith({
            key: "video/original/source.mp4",
            filePath: originalFilePath,
            signal: params.signal,
        });
        expect(mocks.spawn.mock.calls).toEqual([
            [
                "ffprobe",
                [
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=noprint_wrappers=1:nokey=1",
                    originalFilePath,
                ],
                { stdio: ["ignore", "pipe", "ignore"] },
            ],
            [
                "ffmpeg",
                [
                    "-y",
                    "-i",
                    originalFilePath,
                    "-map",
                    "0:v:0",
                    "-map",
                    "0:a:0?",
                    "-profile:v",
                    "baseline",
                    "-c:v",
                    "libx264",
                    "-c:a",
                    "aac",
                    "-vf",
                    "scale='min(1280,iw)':-2",
                    "-level",
                    "3.0",
                    "-start_number",
                    "0",
                    "-hls_time",
                    "10",
                    "-hls_playlist_type",
                    "vod",
                    "-hls_segment_filename",
                    `${convertedDir}/seg_%03d.ts`,
                    "-f",
                    "hls",
                    `${convertedDir}/index.m3u8`,
                ],
                { stdio: ["ignore", "pipe", "ignore"] },
            ],
        ]);
        expect(mocks.upload.mock.calls).toEqual([
            [
                {
                    filePath: `${convertedDir}/seg_000.ts`,
                    key: `${keyPrefix}/seg_000.ts`,
                    contentType: "video/mp2t",
                    signal: params.signal,
                },
            ],
            [
                {
                    filePath: `${convertedDir}/seg_001.ts`,
                    key: `${keyPrefix}/seg_001.ts`,
                    contentType: "video/mp2t",
                    signal: params.signal,
                },
            ],
            [
                {
                    filePath: `${convertedDir}/index.m3u8`,
                    key: `${keyPrefix}/index.m3u8`,
                    contentType: "application/vnd.apple.mpegurl",
                    signal: params.signal,
                },
            ],
        ]);
        expect(mocks.mkdir.mock.calls).toEqual([
            ["tmp", { recursive: true }],
            [convertedDir, { recursive: true }],
        ]);
        expect(remove).toHaveBeenCalledTimes(2);
        expectCleanup();
        expectReleased();
    });
    it.each(["0", "0.999", "2147483647"])("V02: 有効秒数 %s を整数で返す", async (value) => {
        duration = value;
        const result = await convertItemDraftVideo(makeParams());
        expect(result.duration).toBe(Math.floor(Number(value)));
        expectCleanup();
        expectReleased();
    });
});

describe("P0/P1: 入力・出力と途中失敗の後続抑止", () => {
    it.each(["", " \n", "-0.1", "NaN", "Infinity", "2147483648"])(
        "V02: 不正秒数 %j は変換を開始せず422",
        async (value) => {
            duration = value;
            await expectConversionError(convertItemDraftVideo(makeParams()));
            expect(mocks.spawn).toHaveBeenCalledTimes(1);
            expect(mocks.upload).not.toHaveBeenCalled();
            expectCleanup();
            expectReleased();
        },
    );
    it.each(["https://other.test/video.mp4", "https://media.test/", "https://media.test.evil/video.mp4"])(
        "V03: 元URL %s はdownload前に拒否",
        async (originalUrl) => {
            await expectConversionError(convertItemDraftVideo({ ...makeParams(), originalUrl }));
            expect(mocks.download).not.toHaveBeenCalled();
            expect(mocks.spawn).not.toHaveBeenCalled();
            expectCleanup();
        },
    );
    it.each([["seg_000.ts"], ["index.m3u8"], ["index.m3u8", "not-a-segment.ts"]])(
        "V04: playlist/segment不備 %j は公開しない",
        async (...files) => {
            mocks.readdir.mockReturnValue(files);
            await expectConversionError(convertItemDraftVideo(makeParams()));
            expect(mocks.upload).not.toHaveBeenCalled();
            expectCleanup();
            expectReleased();
        },
    );
    it("V05: download障害は同一例外・process未起動でcleanup", async () => {
        const error = new Error("download failed");
        mocks.download.mockRejectedValue(error);
        await expect(convertItemDraftVideo(makeParams())).rejects.toBe(error);
        expect(mocks.spawn).not.toHaveBeenCalled();
        expect(mocks.upload).not.toHaveBeenCalled();
        expectCleanup();
    });
    it.each(["tmp mkdir", "converted mkdir", "readdir"])(
        "V13: %s のI/O失敗でも元原因を保持し自作パスをcleanup",
        async (phase) => {
            const error = new Error("file operation failed");
            if (phase === "readdir")
                mocks.readdir.mockImplementation(() => {
                    throw error;
                });
            else {
                if (phase === "converted mkdir") mocks.mkdir.mockReturnValueOnce(undefined);
                mocks.mkdir.mockImplementationOnce(() => {
                    throw error;
                });
            }
            await expect(convertItemDraftVideo(makeParams())).rejects.toBe(error);
            expect(mocks.upload).not.toHaveBeenCalled();
            if (phase === "tmp mkdir") expect(mocks.download).not.toHaveBeenCalled();
            if (phase === "converted mkdir") expect(mocks.spawn).toHaveBeenCalledTimes(1);
            expectCleanup();
            expectReleased();
        },
    );
    it.each(["ffprobe", "ffmpeg"])("V07: %s 非0終了は422で後続処理なし", async (command) => {
        const defaultSpawn = mocks.spawn.getMockImplementation()!;
        mocks.spawn.mockImplementation((actualCommand: string, ...args: unknown[]) => {
            if (actualCommand !== command) return defaultSpawn(actualCommand, ...args);
            const child = new ProcessFixture();
            children.push(child);
            Promise.resolve().then(() => finish(child, "", 1));
            return child;
        });
        await expectConversionError(convertItemDraftVideo(makeParams()));
        expect(mocks.spawn).toHaveBeenCalledTimes(command === "ffprobe" ? 1 : 2);
        expect(mocks.upload).not.toHaveBeenCalled();
        expectCleanup();
        expectReleased();
    });
    it.each([0, 1, 2])("V10: upload %i 件目の障害では以後の公開を止め元例外を保持", async (index) => {
        const error = new Error("upload failed");
        for (let i = 0; i < index; i++) mocks.upload.mockResolvedValueOnce(undefined);
        mocks.upload.mockRejectedValueOnce(error);
        await expect(convertItemDraftVideo(makeParams())).rejects.toBe(error);
        expect(mocks.upload).toHaveBeenCalledTimes(index + 1);
        expectCleanup();
        expectReleased();
    });
});

describe("P0: process終了回収・timeout・abort・listener解放", () => {
    it.each(["ffprobe", "ffmpeg"])("V06: %s spawn error後もcloseまでcleanupしない", async (command) => {
        const started = deferred<ProcessFixture>();
        const error = new Error("spawn failed");
        const defaultSpawn = mocks.spawn.getMockImplementation()!;
        mocks.spawn.mockImplementation((actualCommand: string, ...args: unknown[]) => {
            if (actualCommand !== command) return defaultSpawn(actualCommand, ...args);
            const child = new ProcessFixture();
            children.push(child);
            started.resolve(child);
            return child;
        });
        const promise = convertItemDraftVideo(makeParams());
        const rejection = expect(promise).rejects.toBe(error);
        const child = await started.promise;
        child.emit("error", error);
        expect(mocks.rm).not.toHaveBeenCalled();
        expect(mocks.upload).not.toHaveBeenCalled();
        finish(child, "", -2);
        await rejection;
        expectCleanup();
        expectReleased();
    });
    it.each(["ffprobe", "ffmpeg"])("V08: %s timeoutはkillしてcloseを待ち408・解放", async (command) => {
        const started = deferred<ProcessFixture>();
        const defaultSpawn = mocks.spawn.getMockImplementation()!;
        mocks.spawn.mockImplementation((actualCommand: string, ...args: unknown[]) => {
            if (actualCommand !== command) return defaultSpawn(actualCommand, ...args);
            const child = new ProcessFixture();
            children.push(child);
            started.resolve(child);
            return child;
        });
        const promise = convertItemDraftVideo(makeParams());
        const rejection = expectConversionError(promise, "VIDEO_CONVERSION_TIMEOUT", 408);
        const child = await started.promise;
        await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
        expect(child.kill).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(child.kill).toHaveBeenCalledExactlyOnceWith("SIGKILL");
        expect(mocks.rm).not.toHaveBeenCalled();
        finish(child, "", null);
        await rejection;
        expectCleanup();
        expectReleased();
    });
    it.each(["ffprobe", "ffmpeg"])("V09/V12: %s 中断後もcloseまでcleanup禁止・abort listener解除", async (command) => {
        const controller = new AbortController();
        const remove = vi.spyOn(controller.signal, "removeEventListener");
        const started = deferred<ProcessFixture>();
        const reason = new AppError("VIDEO_CONVERSION_CANCELLED", 409);
        const defaultSpawn = mocks.spawn.getMockImplementation()!;
        mocks.spawn.mockImplementation((actualCommand: string, ...args: unknown[]) => {
            if (actualCommand !== command) return defaultSpawn(actualCommand, ...args);
            const child = new ProcessFixture();
            children.push(child);
            started.resolve(child);
            return child;
        });
        const promise = convertItemDraftVideo({ ...makeParams(), signal: controller.signal });
        const rejection = expect(promise).rejects.toBe(reason);
        const child = await started.promise;
        controller.abort(reason);
        expect(child.kill).toHaveBeenCalledExactlyOnceWith("SIGKILL");
        expect(mocks.rm).not.toHaveBeenCalled();
        expect(mocks.upload).not.toHaveBeenCalled();
        finish(child, "12", 0);
        await rejection;
        expect(remove).toHaveBeenCalledTimes(children.length);
        expectCleanup();
        expectReleased();
    });
    it("V10: 開始前中断ではdownloadもprocessも開始しない", async () => {
        const controller = new AbortController();
        const reason = new Error("superseded");
        controller.abort(reason);
        await expect(convertItemDraftVideo({ ...makeParams(), signal: controller.signal })).rejects.toBe(reason);
        expect(mocks.download).not.toHaveBeenCalled();
        expect(mocks.spawn).not.toHaveBeenCalled();
        expectCleanup();
    });
    it("V10: download終了時中断はffprobeを開始しない", async () => {
        const controller = new AbortController();
        const reason = new Error("superseded");
        mocks.download.mockImplementation(async () => {
            controller.abort(reason);
        });
        await expect(convertItemDraftVideo({ ...makeParams(), signal: controller.signal })).rejects.toBe(reason);
        expect(mocks.spawn).not.toHaveBeenCalled();
        expectCleanup();
    });
    it.each([0, 1, 2])("V10: upload %i 件目の終了時中断では次のuploadを開始しない", async (index) => {
        const controller = new AbortController();
        const reason = new Error("superseded");
        for (let i = 0; i < index; i++) mocks.upload.mockResolvedValueOnce(undefined);
        mocks.upload.mockImplementationOnce(async () => {
            controller.abort(reason);
        });
        await expect(convertItemDraftVideo({ ...makeParams(), signal: controller.signal })).rejects.toBe(reason);
        expect(mocks.upload).toHaveBeenCalledTimes(index + 1);
        expectCleanup();
        expectReleased();
    });
});

describe("P1: cleanup障害も主原因も保持", () => {
    it("V11: 変換成功後のcleanup単独失敗を伝播し両方のパスを試みる", async () => {
        const error = new Error("remove original failed");
        mocks.rm.mockImplementationOnce(() => {
            throw error;
        });
        const failure: unknown = await convertItemDraftVideo(makeParams()).catch((reason: unknown) => reason);
        expect(failure).toBeInstanceOf(AggregateError);
        expect((failure as AggregateError).errors).toEqual([error]);
        expectCleanup();
        expectReleased();
    });
    it("V11: downloadと両パスのcleanup失敗は全原因の参照を保持", async () => {
        const original = new Error("download failed");
        const removeOriginal = new Error("remove source failed");
        const removeOutput = new Error("remove output failed");
        mocks.download.mockRejectedValue(original);
        mocks.rm
            .mockImplementationOnce(() => {
                throw removeOriginal;
            })
            .mockImplementationOnce(() => {
                throw removeOutput;
            });
        const failure: unknown = await convertItemDraftVideo(makeParams()).catch((reason: unknown) => reason);
        expect(failure).toBeInstanceOf(AggregateError);
        const errors = (failure as AggregateError).errors;
        expect(errors).toHaveLength(2);
        expect(errors[0]).toBe(original);
        expect(errors[1]).toBeInstanceOf(AggregateError);
        expect(errors[1].errors[0]).toBe(removeOriginal);
        expect(errors[1].errors[1]).toBe(removeOutput);
        expectCleanup();
    });
});


describe("P0: 既存編集動画変換との保存先分離", () => {
    it("V14: 同じ所有者・行ID・UUIDでもS3キーと一時パスは別で互いの出力を削除しない", async () => {
        const draftParams = makeParams();
        const editingSignal = new AbortController().signal;
        const [draft, editing] = await Promise.all([
            convertItemDraftVideo(draftParams),
            convertItemEditingVideo({
                userId: 7,
                itemEditingId: 23,
                originalUrl: draftParams.originalUrl,
                signal: editingSignal,
            }),
        ]);
        expect(draft.convertedUrl).toBe(
            "https://media.test/video/converted/item-draft/7/23/request-uuid/index.m3u8",
        );
        expect(editing.convertedUrl).toBe(
            "https://media.test/video/converted/item-editing/7/23/request-uuid/index.m3u8",
        );
        expect(mocks.download.mock.calls).toEqual([
            [{ key: "video/original/source.mp4", filePath: originalFilePath, signal: draftParams.signal }],
            [{
                key: "video/original/source.mp4",
                filePath: "tmp/item_editing_original_request-uuid",
                signal: editingSignal,
            }],
        ]);
        for (const [upload] of mocks.upload.mock.calls) {
            const draftCall = upload.signal === draftParams.signal;
            expect(upload.key).toMatch(
                draftCall
                    ? /^video\/converted\/item-draft\/7\/23\/request-uuid\//
                    : /^video\/converted\/item-editing\/7\/23\/request-uuid\//,
            );
            expect(upload.filePath).toMatch(
                draftCall
                    ? /^tmp\/item_draft_converted_request-uuid\//
                    : /^tmp\/item_editing_converted_request-uuid\//,
            );
        }
        expect(mocks.upload).toHaveBeenCalledTimes(6);
        expect(mocks.rm.mock.calls).toEqual(expect.arrayContaining([
            [originalFilePath, { force: true }],
            [convertedDir, { recursive: true, force: true }],
            ["tmp/item_editing_original_request-uuid", { force: true }],
            ["tmp/item_editing_converted_request-uuid", { recursive: true, force: true }],
        ]));
        expect(mocks.rm).toHaveBeenCalledTimes(4);
        expectReleased();
    });
});
