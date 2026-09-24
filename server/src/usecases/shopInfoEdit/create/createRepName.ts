import { randomUUID } from "node:crypto";
import { buffer } from "node:stream/consumers";
import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { getS3Object } from "../../../infra/aws/getS3Object.js";
import { buckets } from "../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../infra/aws/uploadS3Object.js";
import { createIdCard } from "../../../services/idCard.js";
import { createNameShop } from "../../../services/name.js";
import { createNotification } from "../../../services/notification.js";
import { createS3Metadata } from "../../../services/s3Metadata.js";
import { getMyShopHasRepName } from "../../../services/shopInfo/query.js";
import { createShopEditWithIdCard } from "../../../services/shopInfoEdit/command.js";
import type { CreateShopEditRepNameBody } from "../../../validators/body/shopInfoEdit.js";

type Params = {
    shopId: number;
    userId: number;
    body: CreateShopEditRepNameBody;
};

type UploadedObject = Awaited<ReturnType<typeof uploadS3Object>> & {
    type: "front" | "rear";
    originalFileName: string;
    contentType: string;
    fileSize: number;
};

// POST /shop-info-edit/:id/rep-name
// summary: 代表者氏名データ作成
// page: /edit/name/shop/rep-name/[id]
export const createShopEditRepNameUseCase = async ({ shopId, userId, body }: Params): Promise<void> => {
    const now = Date.now();
    const { sei, mei, seiKana, meiKana, frontIdCard, rearIdCard } = body;
    const shop = await getMyShopHasRepName({ shopId, userId });
    if (!shop) throw new AppError("SHOP_NOT_FOUND", 404);

    const oldFront = shop.IdCard?.FrontIdCard;
    const oldRear = shop.IdCard?.RearIdCard;
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
                objectKey: `idcard/shop-edit/${type}/${shopId}/${now}_${requestId}`,
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

        await sequelize.transaction(async (transaction) => {
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
                    transaction,
                });
                if (object.type === "front") frontS3MetadataId = metadata.id;
                else rearS3MetadataId = metadata.id;
            }
            if (!frontS3MetadataId || !rearS3MetadataId) throw new AppError("S3_METADATA_NOT_FOUND", 404);
            const idCard = await createIdCard({
                data: {
                    front_s3_metadata_id: frontS3MetadataId,
                    rear_s3_metadata_id: rearS3MetadataId,
                },
                transaction,
            });
            const newRepName = await createNameShop({
                data: {
                    sei,
                    mei,
                    sei_kana: seiKana,
                    mei_kana: meiKana,
                    shop_type: "representative",
                },
                transaction,
            });
            await createShopEditWithIdCard({
                data: {
                    idcard_id: idCard.id,
                    user_id: userId,
                    shop_info_id: shopId,
                    name_representative_id: newRepName.id,
                },
                transaction,
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

    // お知らせ作成
    createNotification({
        data: {
            read_user_id: userId,
            message:
                "代表者氏名の変更を受け付けました。審査には1~2週間程度お時間を要する場合がございます。審査完了までしばらくお待ちください。",
            type: "SHOP_EDIT",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
