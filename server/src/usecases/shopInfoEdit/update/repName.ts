import { randomUUID } from "node:crypto";
import { buffer } from "node:stream/consumers";
import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { getS3Object } from "../../../infra/aws/getS3Object.js";
import { buckets } from "../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../infra/aws/uploadS3Object.js";
import { createIdCard } from "../../../services/idCard.js";
import { updateShopName } from "../../../services/name.js";
import { createS3Metadata } from "../../../services/s3Metadata.js";
import { updateShopEditIdCard } from "../../../services/shopInfoEdit/command.js";
import { getMyShopEditHasRepName } from "../../../services/shopInfoEdit/query.js";
import { UpdateShopEditRepNameBody } from "../../../validators/body/shopInfoEdit.js";

type Params = {
    shopEditId: number;
    userId: number;
    body: UpdateShopEditRepNameBody;
};

type UploadedObject = Awaited<ReturnType<typeof uploadS3Object>> & {
    type: "front" | "rear";
    originalFileName: string;
    contentType: string;
    fileSize: number;
};

// PATCH /shop-info-edit/:id/rep-name
// summary: 代表者氏名データ作成
// page: /edit/name/shop/rep-name/[id]
export const updateShopEditRepNameUseCase = async ({ shopEditId, userId, body }: Params): Promise<void> => {
    const now = Date.now();
    const { sei, mei, seiKana, meiKana, frontIdCard, rearIdCard } = body;
    const shopEdit = await getMyShopEditHasRepName({ shopEditId, userId });
    if (!shopEdit) throw new AppError("SHOP_EDIT_NOT_FOUND", 404);

    const oldFront = shopEdit.IdCard?.FrontIdCard;
    const oldRear = shopEdit.IdCard?.RearIdCard;
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
                objectKey: `idcard/shop-edit/${shopEditId}/${type}/${now}_${requestId}`,
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

            const newIdCard = await createIdCard({
                data: {
                    front_s3_metadata_id: frontS3MetadataId,
                    rear_s3_metadata_id: rearS3MetadataId,
                },
                transaction: t,
            });

            await updateShopEditIdCard({
                shopEdit,
                data: {
                    idcard_id: newIdCard.id,
                },
                transaction: t,
            });

            await updateShopName({
                name: shopEdit.RepresentativeNameEdit,
                data: {
                    sei,
                    mei,
                    sei_kana: seiKana,
                    mei_kana: meiKana,
                    shop_type: "representative",
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
