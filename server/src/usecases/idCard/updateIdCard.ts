import { randomUUID } from "node:crypto";
import { buffer } from "node:stream/consumers";
import sequelize from "../../db.js";
import { AppError } from "../../errors.js";
import { deleteS3Object } from "../../infra/aws/deleteS3Object.js";
import { getS3Object } from "../../infra/aws/getS3Object.js";
import { buckets } from "../../infra/aws/s3.js";
import { uploadS3Object } from "../../infra/aws/uploadS3Object.js";
import { getMyIdCard, updateIdCard } from "../../services/idCard.js";
import { createS3Metadata } from "../../services/s3Metadata.js";
import { UpdateIdCardBody } from "../../validators/body/idCard.js";

type Params = {
    idCardId: number;
    userId: number;
    body: UpdateIdCardBody;
};

type UploadedObject = Awaited<ReturnType<typeof uploadS3Object>> & {
    type: "front" | "rear";
    originalFileName: string;
    contentType: string;
    fileSize: number;
};

// PATCH /id-card/:id
// summary: 身分証データ更新
// page: /edit/id-card
export const updateIdCardUseCase = async ({ idCardId, userId, body }: Params) => {
    const now = Date.now();
    const { frontIdCard, rearIdCard } = body;

    // idcard取得
    const idCard = await getMyIdCard({ idCardId, userId });

    if (!idCard) {
        throw new AppError("ID_CARD_NOT_FOUND", 404);
    }

    const oldFront = idCard?.FrontIdCard;
    const oldRear = idCard?.RearIdCard;

    if (!frontIdCard && (!oldFront || oldFront.id !== body.frontS3MetadataId)) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }
    if (!rearIdCard && (!oldRear || oldRear.id !== body.rearS3MetadataId)) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }

    const uploadedObjects: UploadedObject[] = [];
    const requestId = randomUUID();

    try {
        const images = [
            { type: "front", file: frontIdCard, existing: oldFront },
            { type: "rear", file: rearIdCard, existing: oldRear },
        ] as const;

        for (const { type, file, existing } of images) {
            let image = file;

            // 既存画像も申請専用に複製し、現在のショップと保存先・メタデータを共有しない。
            if (!image) {
                if (!existing) throw new AppError("S3_METADATA_NOT_FOUND", 404);

                const existingObject = await getS3Object({
                    bucketName: existing.bucket_name,
                    objectKey: existing.object_key,
                    versionId: existing.version_id,
                });

                const imageBuffer = await buffer(existingObject.body);

                image = {
                    buffer: imageBuffer,
                    fileName: existing.original_file_name ?? `${type}.jpg`,
                    contentType: existing.content_type,
                    size: imageBuffer.length,
                };
            }

            const uploaded = await uploadS3Object({
                bucketName: buckets.verificationDocuments,
                objectKey: `idcard/user/${userId}/${type}/${now}_${requestId}`,
                body: image.buffer,
                contentType: image.contentType,
            });

            uploadedObjects.push({
                ...uploaded,
                type,
                originalFileName: image.fileName,
                contentType: image.contentType,
                fileSize: image.size,
            });
        }

        await sequelize.transaction(async (t) => {
            let frontS3MetadataId: number | undefined;
            let rearS3MetadataId: number | undefined;

            for (const object of uploadedObjects) {
                const metadata = await createS3Metadata({
                    data: {
                        bucket_name: object.bucketName,
                        object_key: object.objectKey,
                        version_id: object.versionId,
                        original_file_name: object.originalFileName,
                        content_type: object.contentType,
                        file_size: object.fileSize,
                        etag: object.etag,
                    },
                    transaction: t,
                });

                if (object.type === "front") frontS3MetadataId = metadata.id;
                else rearS3MetadataId = metadata.id;
            }

            if (!frontS3MetadataId || !rearS3MetadataId) {
                throw new AppError("S3_METADATA_NOT_FOUND", 404);
            }

            await updateIdCard({
                idCard,
                data: {
                    front_s3_metadata_id: frontS3MetadataId,
                    rear_s3_metadata_id: rearS3MetadataId,
                },
                transaction: t,
            });
        });
    } catch (err) {
        const cleanupResults = await Promise.allSettled(
            uploadedObjects.map((object) =>
                deleteS3Object({
                    bucketName: object.bucketName,
                    objectKey: object.objectKey,
                    versionId: object.versionId,
                }),
            ),
        );

        for (const result of cleanupResults) {
            if (result.status === "rejected") console.error("S3補償削除失敗:", result.reason);
        }

        throw err;
    }
};
