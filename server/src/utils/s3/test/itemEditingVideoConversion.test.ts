import { EventEmitter } from "node:events";
import { PassThrough, Readable } from "node:stream";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../../../errors.js";

const mocks = vi.hoisted(() => ({ send: vi.fn(), pipeline: vi.fn(), read: vi.fn(), write: vi.fn() }));
vi.mock("../../../infra/aws/s3.js", () => ({ buckets: { public: "test-public" }, s3: { send: mocks.send } }));
vi.mock("node:stream/promises", () => ({ pipeline: mocks.pipeline }));
vi.mock("fs", () => ({ default: { createReadStream: mocks.read, createWriteStream: mocks.write } }));
import { downloadVideoFromS3, uploadVideoToS3 } from "../videoConvert.js";

class UploadStreamFixture extends EventEmitter {
    closed = false;
    destroy = vi.fn(() => this);
    close() {
        this.closed = true;
        this.emit("close");
    }
}
const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.pipeline.mockResolvedValue(undefined);
});
afterEach(() => { vi.restoreAllMocks(); });

describe("P0: S3 download utilityのSDK/stream境界（AWS通信・実I/Oなし）", () => {
    it.each([true, false])("A01: signal=%s をSDK・pipelineへ渡し旧呼出し契約も維持", async (withSignal) => {
        const signal = withSignal ? new AbortController().signal : undefined;
        const body = Readable.from(["source video"]);
        const output = new PassThrough();
        mocks.send.mockResolvedValue({ Body: body });
        mocks.write.mockReturnValue(output);
        await downloadVideoFromS3({ key: "video/source.mp4", filePath: "tmp/source", signal });
        expect(mocks.send).toHaveBeenCalledTimes(1);
        const [command, ...options] = mocks.send.mock.calls[0]!;
        expect(command).toBeInstanceOf(GetObjectCommand);
        expect(command.input).toEqual({ Bucket: "test-public", Key: "video/source.mp4" });
        expect(options).toEqual(withSignal ? [{ abortSignal: signal }] : []);
        expect(mocks.write).toHaveBeenCalledExactlyOnceWith("tmp/source");
        expect(mocks.pipeline.mock.calls).toEqual([withSignal ? [body, output, { signal }] : [body, output]]);
        body.destroy();
        output.destroy();
    });
    it.each([undefined, null, "not a readable", {}])("A02: Body=%j はAppError 500・pipeline未起動", async (Body) => {
        mocks.send.mockResolvedValue({ Body });
        const error: unknown = await downloadVideoFromS3({ key: "key", filePath: "tmp/file" }).catch((reason: unknown) => reason);
        expect(error).toBeInstanceOf(AppError);
        expect(error).toMatchObject({ code: "S3_OBJECT_BODY_INVALID", statusCode: 500 });
        expect(mocks.write).not.toHaveBeenCalled();
        expect(mocks.pipeline).not.toHaveBeenCalled();
    });
    it("A03: GetObject障害は元例外を伝播しファイルを開かない", async () => {
        const error = new Error("SDK failed");
        mocks.send.mockRejectedValue(error);
        await expect(downloadVideoFromS3({ key: "key", filePath: "tmp/file" })).rejects.toBe(error);
        expect(mocks.write).not.toHaveBeenCalled();
        expect(mocks.pipeline).not.toHaveBeenCalled();
    });
    it("A03: pipelineの完了を待ち中断例外を同一参照で伝播", async () => {
        const started = deferred<void>();
        const release = deferred<void>();
        const body = Readable.from(["video"]);
        const output = new PassThrough();
        const error = new Error("aborted pipeline");
        mocks.send.mockResolvedValue({ Body: body });
        mocks.write.mockReturnValue(output);
        mocks.pipeline.mockImplementation(async () => { started.resolve(); await release.promise; throw error; });
        let settled = false;
        const promise = downloadVideoFromS3({ key: "key", filePath: "tmp/file", signal: new AbortController().signal });
        const rejection = expect(promise).rejects.toBe(error);
        void promise.then(() => { settled = true; }, () => { settled = true; });
        await started.promise;
        expect(settled).toBe(false);
        release.resolve();
        await rejection;
        body.destroy();
        output.destroy();
    });
});

describe("P0: S3 upload utilityのSDK引渡し・stream終了回収", () => {
    it.each([true, false])("A04: signal=%s、MIMEとBodyを渡しdestroy後closeまで完了しない", async (withSignal) => {
        const signal = withSignal ? new AbortController().signal : undefined;
        const stream = new UploadStreamFixture();
        const destroyStarted = deferred<void>();
        const sdkStarted = deferred<void>();
        const sdkRelease = deferred<void>();
        stream.destroy.mockImplementation(() => { destroyStarted.resolve(); return stream; });
        mocks.read.mockReturnValue(stream);
        mocks.send.mockImplementation(async () => { sdkStarted.resolve(); await sdkRelease.promise; });
        let settled = false;
        const promise = uploadVideoToS3({ key: "video/index.m3u8", filePath: "tmp/index.m3u8", contentType: "application/vnd.apple.mpegurl", signal });
        void promise.then(() => { settled = true; }, () => { settled = true; });
        await sdkStarted.promise;
        expect(stream.destroy).not.toHaveBeenCalled();
        expect(settled).toBe(false);
        sdkRelease.resolve();
        await destroyStarted.promise;
        expect(settled).toBe(false);
        const [command, ...options] = mocks.send.mock.calls[0]!;
        expect(command).toBeInstanceOf(PutObjectCommand);
        expect(command.input).toEqual({ Bucket: "test-public", Key: "video/index.m3u8", Body: stream, ContentType: "application/vnd.apple.mpegurl" });
        expect(command.input.Body).toBe(stream);
        expect(options).toEqual(withSignal ? [{ abortSignal: signal }] : []);
        expect(mocks.read).toHaveBeenCalledExactlyOnceWith("tmp/index.m3u8");
        stream.close();
        await promise;
        expect(stream.destroy).toHaveBeenCalledOnce();
        expect(stream.listenerCount("close")).toBe(0);
    });
    it.each([true, false])("A05: signal=%s のSDK失敗でもcloseまで待ち元原因を保持", async (withSignal) => {
        const stream = new UploadStreamFixture();
        const destroyed = deferred<void>();
        const error = new Error("upload failed");
        stream.destroy.mockImplementation(() => { destroyed.resolve(); return stream; });
        mocks.read.mockReturnValue(stream);
        mocks.send.mockRejectedValue(error);
        let settled = false;
        const promise = uploadVideoToS3({ key: "video/seg_000.ts", filePath: "tmp/segment", contentType: "video/mp2t", signal: withSignal ? new AbortController().signal : undefined });
        const rejection = expect(promise).rejects.toBe(error);
        void promise.then(() => { settled = true; }, () => { settled = true; });
        await destroyed.promise;
        expect(settled).toBe(false);
        stream.close();
        await rejection;
        expect(stream.destroy).toHaveBeenCalledOnce();
        expect(stream.listenerCount("close")).toBe(0);
    });
    it("A04: destroy時点でclosedなら追加イベントを待たず完了", async () => {
        const stream = new UploadStreamFixture();
        stream.destroy.mockImplementation(() => { stream.closed = true; return stream; });
        mocks.read.mockReturnValue(stream);
        mocks.send.mockResolvedValue({});
        await uploadVideoToS3({ key: "key", filePath: "tmp/file", contentType: "video/mp2t" });
        expect(stream.destroy).toHaveBeenCalledOnce();
        expect(stream.listenerCount("close")).toBe(0);
    });
    it("A05: createReadStream同期失敗は元例外を伝播しSDK未呼出し", async () => {
        const error = new Error("open failed");
        mocks.read.mockImplementation(() => { throw error; });
        await expect(uploadVideoToS3({ key: "key", filePath: "tmp/file", contentType: "video/mp2t" })).rejects.toBe(error);
        expect(mocks.send).not.toHaveBeenCalled();
    });
    it.each(["abort", "stream"])("A06: %s が先にSDKを失敗させても競合原因に置換せずstream終了を回収", async (first) => {
        const controller = new AbortController();
        const abortError = new Error("SDK aborted");
        const streamError = new Error("SDK observed stream failure");
        const stream = new UploadStreamFixture();
        const started = deferred<void>();
        const destroyed = deferred<void>();
        stream.destroy.mockImplementation(() => { destroyed.resolve(); return stream; });
        mocks.read.mockReturnValue(stream);
        // stream errorとabortの解釈はSDK境界の責務。先にrejectした原因の伝播だけを保証する。
        const onAbort = vi.fn();
        mocks.send.mockImplementation(() => new Promise<void>((_resolve, reject) => {
            stream.once("error", reject);
            onAbort.mockImplementation(() => reject(abortError));
            controller.signal.addEventListener("abort", onAbort, { once: true });
            started.resolve();
        }));
        const promise = uploadVideoToS3({ key: "key", filePath: "tmp/file", contentType: "video/mp2t", signal: controller.signal });
        const rejection = expect(promise).rejects.toBe(first === "abort" ? abortError : streamError);
        await started.promise;
        if (first === "abort") {
            controller.abort(abortError);
            stream.emit("error", streamError);
        } else {
            stream.emit("error", streamError);
            controller.abort(abortError);
        }
        await destroyed.promise;
        stream.close();
        await rejection;
        expect(stream.destroy).toHaveBeenCalledOnce();
        expect(stream.listenerCount("close")).toBe(0);
        expect(stream.listenerCount("error")).toBe(0);
    });
});
