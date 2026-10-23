import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { buckets, s3 } from "../../infra/aws/s3.js";
import fs from "fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { AppError } from "../../errors.js";

type DownloadParams = {
    key: string;
    filePath: string;
    signal?: AbortSignal;
};

type UploadParams = {
    key: string;
    filePath: string;
    contentType: string;
    signal?: AbortSignal;
};

export const downloadVideoFromS3 = async ({ key, filePath, signal }: DownloadParams) => {
    const getObjectCommand = new GetObjectCommand({
        Bucket: buckets.public,
        Key: key,
    });

    const s3Object = signal
        ? await s3.send(getObjectCommand, { abortSignal: signal })
        : await s3.send(getObjectCommand);
    if (!(s3Object.Body instanceof Readable)) {
        throw new AppError("S3_OBJECT_BODY_INVALID", 500);
    }

    if (signal) await pipeline(s3Object.Body, fs.createWriteStream(filePath), { signal });
    else await pipeline(s3Object.Body, fs.createWriteStream(filePath));
};

export const uploadVideoToS3 = async ({ filePath, key, contentType, signal }: UploadParams) => {
    const stream = fs.createReadStream(filePath);
    try {
        const command = new PutObjectCommand({
            Bucket: buckets.public,
            Key: key,
            Body: stream,
            ContentType: contentType,
        });
        if (signal) await s3.send(command, { abortSignal: signal });
        else await s3.send(command);
    } finally {
        stream.destroy();
        if (!stream.closed) await new Promise<void>((resolve) => stream.once("close", resolve));
    }
};
