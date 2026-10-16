import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import { AppError } from "../../errors.js";
import { publicS3Domain } from "../../infra/aws/s3.js";
import { getMyVideo, updateStatus } from "../../services/video/video.js";
import { getDuration } from "../../utils/ffmpeg.js";
import { createFfmpegCompletionPromise } from "../../utils/ffmpegCompletion.js";
import { downloadVideoFromS3, uploadVideoToS3 } from "../../utils/s3/index.js";
import { cleanupVideoConversionFiles } from "../../utils/videoConversionCleanup.js";

type Params = {
    videoId: number;
    userId: number;
};

// PATCH /video/:id/convert
// summary: 動画HLS変換
// page: /upload
export const convertVideoUseCase = async ({ videoId, userId }: Params) => {
    const now = Date.now();
    const tempId = crypto.randomUUID();

    // video取得
    const video = await getMyVideo({ videoId, userId });
    if (!video) {
        throw new AppError("VIDEO_NOT_FOUND", 404);
    }

    const originalUrl = video.original_url;
    if (!originalUrl) {
        throw new AppError("ORIGINAL_URL_NOT_FOUND", 400);
    }

    const originalKey = originalUrl.replace(`${publicS3Domain}/`, "");

    // 一時保存先
    const originalFilePath = `tmp/original_${videoId}_${now}_${tempId}`;
    const convertedDir = `tmp/converted_${videoId}_${now}_${tempId}`;
    let hasConversionError = false;
    let conversionError: unknown;
    let cleanupError: unknown;

    try {
        fs.mkdirSync("tmp", { recursive: true });

        await downloadVideoFromS3({ key: originalKey, filePath: originalFilePath });

        await updateStatus({ video, data: { status: "processing" } });

        // 変換ディレクトリ作成
        fs.mkdirSync(convertedDir, { recursive: true });

        // ffmpegでHLS変換
        const ffmpeg = spawn("ffmpeg", [
            "-y", // ← 追加（既存ファイルを上書き）
            "-i",
            originalFilePath,
            "-map",
            "0:v:0", // ← 追加（動画トラックを明示）
            "-map",
            "0:a:0?", // ← 追加（音声はあれば使う）
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
            `${convertedDir}/${now}_${tempId}_seg_%03d.ts`, // ← 追加（名前が綺麗）
            "-f",
            "hls",
            `${convertedDir}/${now}_${tempId}_index.m3u8`,
        ]);

        const conversionPromise = createFfmpegCompletionPromise({
            ffmpeg,
            timeoutMs: 5 * 60 * 1000,
            onError: async (error) => {
                try {
                    await updateStatus({ video, data: { status: "failed" } });
                } catch (statusError) {
                    console.error("Failed to update video status", {
                        videoId,
                        error: statusError,
                    });
                }

                throw error;
            },
            onTimeout: async () => {
                await updateStatus({ video, data: { status: "failed" } });
                throw new AppError("ffmpeg timeout", 408);
            },
            onClose: async (code) => {
                if (code !== 0) {
                    await updateStatus({ video, data: { status: "failed" } });
                    throw new AppError(`ffmpeg exited with code ${code}`, 422);
                }

                try {
                    const seconds = await durationPromise;

                    // HLSファイル生成
                    const files = fs.readdirSync(convertedDir);

                    const hasPlaylist = files.some((f) => f.endsWith(".m3u8"));
                    if (!hasPlaylist) {
                        throw new AppError("playlist not generated", 422);
                    }

                    // HLSファイルS3アップロード
                    for (const f of files) {
                        const filePath = `${convertedDir}/${f}`;
                        const key = `video/converted/${userId}/${videoId}/${f}`;

                        const contentType = f.endsWith(".ts")
                            ? "video/mp2t"
                            : f.endsWith(".m3u8")
                              ? "application/vnd.apple.mpegurl"
                              : "application/octet-stream";

                        await uploadVideoToS3({ filePath, key, contentType });
                    }

                    const convertedUrl = `${publicS3Domain}/video/converted/${userId}/${videoId}/${now}_${tempId}_index.m3u8`;

                    // video更新
                    await updateStatus({
                        video,
                        data: {
                            status: "done",
                            converted_url: convertedUrl,
                            duration: seconds,
                        },
                    });
                } catch (error) {
                    await updateStatus({ video, data: { status: "failed" } });

                    if (error instanceof AppError) throw error;
                    throw new AppError("server error", 500);
                }
            },
        });

        ffmpeg.stderr.on("data", (data) => {
            console.log(data.toString());
        });

        // 再生時間
        const durationPromise = getDuration({ filePath: originalFilePath }).catch((error: unknown) => {
            console.error(error);
            return 0;
        });

        await conversionPromise;
    } catch (error) {
        hasConversionError = true;
        conversionError = error;
    } finally {
        try {
            cleanupVideoConversionFiles({ originalFilePath, convertedDir });
        } catch (error) {
            cleanupError = error;
        }
    }

    if (hasConversionError) {
        if (cleanupError) {
            console.error("Video conversion cleanup failed", {
                videoId,
                error: cleanupError,
            });
        }

        throw conversionError;
    }

    if (cleanupError) {
        throw cleanupError;
    }
};
