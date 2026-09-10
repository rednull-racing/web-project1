import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { buckets } from "../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../infra/aws/uploadS3Object.js";
import { createIdCard } from "../../../services/idCard.js";
import { createNotification } from "../../../services/notification.js";
import { createPermit } from "../../../services/permit.js";
import { createS3Metadata, deleteS3Metadata } from "../../../services/s3Metadata.js";
import { UpdateShopEditIdPermit } from "../../../services/shopInfoEdit/command.js";
import { getMyShopEditHasShop } from "../../../services/shopInfoEdit/query.js";
import type { ShopInfoEditIdImageBody } from "../../../validators/body/shopInfoEdit.js";
import { UploadedObject } from "./idImageType.js";

type Params = {
    shopEditId: number;
    userId: number;
    body: ShopInfoEditIdImageBody;
};

// PATCH /shop-info-edit/:id/id-image-upload
// summary: 事業者登録 代表者身分証アップロード
// page: edit/shop/com-free/upload/[id]
export const updateShopEditIdImageUseCase = async ({ shopEditId, userId, body }: Params): Promise<void> => {
    const now = Date.now();
    const { frontIdCard, rearIdCard, permitFiles } = body;

    if (permitFiles.length > 10) {
        throw new AppError("OVER_MAX_PERMIT_FILE_COUNT", 400);
    }

    const shopEdit = await getMyShopEditHasShop({ shopEditId, userId });

    if (!shopEdit) throw new AppError("SHOP_EDIT_NOT_FOUND", 404);

    const shopId = shopEdit.ShopInfo.id;
    const uploadedObjects: UploadedObject[] = [];
    let committed = false;

    try {
        const uploadedFront = await uploadS3Object({
            bucketName: buckets.verificationDocuments,
            objectKey: `idcard/shop/front/${shopId}/${now}_${frontIdCard.fileName}`,
            body: frontIdCard.buffer,
            contentType: frontIdCard.contentType,
        });
        uploadedObjects.push({
            ...uploadedFront,
            type: "idCardFront",
            originalFileName: frontIdCard.fileName,
            contentType: frontIdCard.contentType,
            fileSize: frontIdCard.size,
        });

        const uploadedRear = await uploadS3Object({
            bucketName: buckets.verificationDocuments,
            objectKey: `idcard/shop/rear/${shopId}/${now}_${rearIdCard.fileName}`,
            body: rearIdCard.buffer,
            contentType: rearIdCard.contentType,
        });
        uploadedObjects.push({
            ...uploadedRear,
            type: "idCardRear",
            originalFileName: rearIdCard.fileName,
            contentType: rearIdCard.contentType,
            fileSize: rearIdCard.size,
        });

        const permitUploadResults = await Promise.allSettled(
            permitFiles.map(async (file, index) => {
                const uploaded = await uploadS3Object({
                    bucketName: buckets.verificationDocuments,
                    objectKey: `permit/${shopId}/${now}_${file.fileName}`,
                    body: file.buffer,
                    contentType: file.contentType,
                });

                uploadedObjects.push({
                    ...uploaded,
                    type: "permit",
                    originalFileName: file.fileName,
                    contentType: file.contentType,
                    fileSize: file.size,
                    sortOrder: index + 1,
                });
            }),
        );

        const failedPermitUpload = permitUploadResults.find((result) => result.status === "rejected");
        if (failedPermitUpload?.status === "rejected") throw failedPermitUpload.reason;

        await sequelize.transaction(async (transaction) => {
            let frontIdCardS3MetadataId: number | null = null;
            let rearIdCardS3MetadataId: number | null = null;
            const permitS3MetadataList: Array<{ s3MetadataId: number; sortOrder: number }> = [];

            const s3MetadataList = await Promise.all(
                uploadedObjects.map(async (uploadedObject) => ({
                    uploadedObject,
                    s3Metadata: await createS3Metadata({
                        data: {
                            bucket_name: uploadedObject.bucketName,
                            object_key: uploadedObject.objectKey,
                            version_id: uploadedObject.versionId,
                            original_file_name: uploadedObject.originalFileName,
                            content_type: uploadedObject.contentType,
                            file_size: uploadedObject.fileSize,
                            etag: uploadedObject.etag,
                        },
                        transaction,
                    }),
                })),
            );

            for (const { uploadedObject, s3Metadata } of s3MetadataList) {
                if (uploadedObject.type === "idCardFront") {
                    frontIdCardS3MetadataId = s3Metadata.id;
                } else if (uploadedObject.type === "idCardRear") {
                    rearIdCardS3MetadataId = s3Metadata.id;
                } else {
                    permitS3MetadataList.push({
                        s3MetadataId: s3Metadata.id,
                        sortOrder: uploadedObject.sortOrder,
                    });
                }
            }

            if (!frontIdCardS3MetadataId || !rearIdCardS3MetadataId) {
                throw new AppError("INVALID_BODY", 400);
            }

            const newIdCard = await createIdCard({
                data: {
                    front_s3_metadata_id: frontIdCardS3MetadataId,
                    rear_s3_metadata_id: rearIdCardS3MetadataId,
                },
                transaction,
            });

            if (permitS3MetadataList.length > 0) {
                await Promise.all(
                    permitS3MetadataList.map((permit) =>
                        createPermit({
                            data: {
                                s3_metadata_id: permit.s3MetadataId,
                                sort_order: permit.sortOrder,
                                document_name: null,
                                memo: null,
                                permit_number: null,
                                permit_type: null,
                                issued_at: null,
                                expired_at: null,
                                shop_info_id: null,
                                shop_info_edit_id: shopEditId,
                                shop_signup_id: null,
                            },
                            transaction,
                        }),
                    ),
                );
            }

            await UpdateShopEditIdPermit({
                shopEdit,
                data: {
                    idcard_id: newIdCard.id,
                },
                transaction,
            });
        });

        committed = true;
    } catch (err) {
        if (!committed) {
            await Promise.allSettled(
                uploadedObjects.map((object) =>
                    deleteS3Object({
                        bucketName: object.bucketName,
                        objectKey: object.objectKey,
                        versionId: object.versionId,
                    }),
                ),
            );
        }

        throw err;
    }

    const oldFrontS3Metadata = shopEdit.IdCard?.FrontIdCard ?? null;
    const oldRearS3Metadata = shopEdit.IdCard?.RearIdCard ?? null;
    const oldPermitFiles = shopEdit.Permit ?? [];
    type S3MetadataInstance = Parameters<typeof deleteS3Metadata>[0]["s3Metadata"];
    const oldPermitS3Metadata = oldPermitFiles
        .map((permitFile: { S3Metadata?: S3MetadataInstance | null }) => permitFile.S3Metadata)
        .filter((s3Metadata: S3MetadataInstance | null | undefined): s3Metadata is S3MetadataInstance =>
            Boolean(s3Metadata),
        );

    await sequelize.transaction(async (transaction) => {
        if (oldFrontS3Metadata) {
            await deleteS3Metadata({ s3Metadata: oldFrontS3Metadata, transaction });
        }

        if (oldRearS3Metadata) {
            await deleteS3Metadata({ s3Metadata: oldRearS3Metadata, transaction });
        }

        await Promise.all(
            oldPermitS3Metadata.map((s3Metadata: S3MetadataInstance) => deleteS3Metadata({ s3Metadata, transaction })),
        );
    });

    createNotification({
        data: {
            read_user_id: userId,
            message:
                "事業形態の変更が完了しました。審査完了まで1~2週間ほどお時間を頂戴しておりますため、しばらくお待ちください。",
            type: "SHOP_EDIT",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
