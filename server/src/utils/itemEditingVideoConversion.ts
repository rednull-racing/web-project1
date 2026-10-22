import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { AppError } from "../errors.js";
import { publicS3Domain } from "../infra/aws/s3.js";
import { downloadVideoFromS3, uploadVideoToS3 } from "./s3/videoConvert.js";
import { cleanupVideoConversionFiles } from "./videoConversionCleanup.js";

type Params = { userId: number; itemEditingId: number; originalUrl: string; signal: AbortSignal };

const runProcess = async ({
    command,
    args,
    signal,
}: { command: string; args: string[]; signal: AbortSignal }): Promise<string> => {
    signal.throwIfAborted();
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });

    return await new Promise<string>((resolve, reject) => {
        let output = "";
        let processError: unknown;
        const onData = (chunk: Buffer) => { output += chunk.toString(); };
        const onError = (error: Error) => { processError = error; };
        const onAbort = () => { child.kill("SIGKILL"); };
        const timer = setTimeout(() => {
            processError = new AppError("VIDEO_CONVERSION_TIMEOUT", 408);
            child.kill("SIGKILL");
        }, 5 * 60 * 1000);

        // spawn失敗もcloseに到達する。終了後まで待ち、一時パスへ書き込むプロセスを残さない。
        child.once("error", onError);
        child.once("close", (code) => {
            clearTimeout(timer);
            signal.removeEventListener("abort", onAbort);
            child.removeListener("error", onError);
            child.stdout.removeListener("data", onData);
            if (signal.aborted) reject(signal.reason);
            else if (processError) reject(processError);
            else if (code !== 0) reject(new AppError("VIDEO_CONVERSION_FAILED", 422));
            else resolve(output);
        });
        child.stdout.on("data", onData);
        signal.addEventListener("abort", onAbort, { once: true });
        if (signal.aborted) onAbort();
    });
};

export const convertItemEditingVideo = async ({ userId, itemEditingId, originalUrl, signal }: Params) => {
    const requestId = randomUUID();
    const originalFilePath = `tmp/item_editing_original_${requestId}`;
    const convertedDir = `tmp/item_editing_converted_${requestId}`;
    const keyPrefix = `video/converted/item-editing/${userId}/${itemEditingId}/${requestId}`;
    let failure: { error: unknown } | undefined;
    let cleanupFailure: { error: unknown } | undefined;
    let result: { convertedUrl: string; duration: number } | undefined;

    try {
        signal.throwIfAborted();
        const prefix = `${publicS3Domain}/`;
        if (!originalUrl.startsWith(prefix) || originalUrl.length === prefix.length) {
            throw new AppError("VIDEO_CONVERSION_FAILED", 422);
        }
        fs.mkdirSync("tmp", { recursive: true });
        await downloadVideoFromS3({ key: originalUrl.slice(prefix.length), filePath: originalFilePath, signal });
        signal.throwIfAborted();

        const durationOutput = await runProcess({
            command: "ffprobe",
            args: ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", originalFilePath],
            signal,
        });
        const seconds = Number(durationOutput.trim());
        if (!durationOutput.trim() || !Number.isFinite(seconds) || seconds < 0 || seconds > 2147483647) {
            throw new AppError("VIDEO_CONVERSION_FAILED", 422);
        }
        fs.mkdirSync(convertedDir, { recursive: true });
        await runProcess({
            command: "ffmpeg",
            args: [
                "-y", "-i", originalFilePath, "-map", "0:v:0", "-map", "0:a:0?",
                "-profile:v", "baseline", "-c:v", "libx264", "-c:a", "aac",
                "-vf", "scale='min(1280,iw)':-2", "-level", "3.0", "-start_number", "0",
                "-hls_time", "10", "-hls_playlist_type", "vod", "-hls_segment_filename",
                `${convertedDir}/seg_%03d.ts`, "-f", "hls", `${convertedDir}/index.m3u8`,
            ],
            signal,
        });
        signal.throwIfAborted();
        const files = fs.readdirSync(convertedDir);
        if (!files.includes("index.m3u8") || !files.some((file) => /^seg_\d+\.ts$/.test(file))) {
            throw new AppError("VIDEO_CONVERSION_FAILED", 422);
        }
        // playlistは全segmentの後で公開する。
        for (const file of [...files.filter((file) => /^seg_\d+\.ts$/.test(file)), "index.m3u8"]) {
            signal.throwIfAborted();
            await uploadVideoToS3({
                filePath: `${convertedDir}/${file}`,
                key: `${keyPrefix}/${file}`,
                contentType: file.endsWith(".ts") ? "video/mp2t" : "application/vnd.apple.mpegurl",
                signal,
            });
            signal.throwIfAborted();
        }
        result = { convertedUrl: `${publicS3Domain}/${keyPrefix}/index.m3u8`, duration: Math.floor(seconds) };
    } catch (error) {
        failure = { error };
    } finally {
        try {
            cleanupVideoConversionFiles({ originalFilePath, convertedDir });
        } catch (cleanupError) {
            cleanupFailure = { error: cleanupError };
        }
    }
    if (cleanupFailure) {
        if (failure) throw new AggregateError([failure.error, cleanupFailure.error], "Conversion and cleanup failed");
        throw cleanupFailure.error;
    }
    if (failure) throw failure.error;
    if (!result) throw new AppError("VIDEO_CONVERSION_FAILED", 422);
    return result;
};
