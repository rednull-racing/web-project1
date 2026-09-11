import sequelize from "../../../../db.js";
import { AppError } from "../../../../errors.js";
import { deleteS3Object } from "../../../../infra/aws/deleteS3Object.js";
import { buckets } from "../../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../../infra/aws/uploadS3Object.js";
import { createIdCard, updateIdCardS3Metadata } from "../../../../services/idCard.js";
import { createPermit, deletePermit, updatePermit } from "../../../../services/permit.js";
import { createS3Metadata, deleteS3Metadata } from "../../../../services/s3Metadata.js";
import { getMyShopSignupHasS3Data, updateSignup3 } from "../../../../services/shopSignup.js";
import type { ShopSignup3Body } from "../../../../validators/body/shopSignup.js";
import type { UploadedObject } from "./type.js";

type Params = {
    shopSignupId: number;
    userId: number;
    body: ShopSignup3Body;
};

// PATCH /shop-signup/:id/id-card
// summary: ショップ登録身分証・許認可証追加
// page: /shop-signup/step3/[id]
export const updateShopSignup3UseCase = async ({ shopSignupId, userId, body }: Params): Promise<void> => {
    const now = Date.now();
    const { frontIdCard, rearIdCard, permitFiles, permits } = body;
    const shopSignup = await getMyShopSignupHasS3Data({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    const idCard = shopSignup.IdCard;
    const oldFront = idCard?.FrontIdCard;
    const oldRear = idCard?.RearIdCard;
    const oldPermits = shopSignup.Permit ?? [];

    if (!frontIdCard && (!oldFront || oldFront.id !== body.frontS3MetadataId)) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }
    if (!rearIdCard && (!oldRear || oldRear.id !== body.rearS3MetadataId)) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }

    const resolvedPermits = permits.map((permit, index) => {
        const file = permit.fileIndex === undefined ? undefined : permitFiles[permit.fileIndex];
        const existingPermit =
            permit.s3MetadataId === undefined
                ? undefined
                : oldPermits.find((oldPermit) => oldPermit.S3Metadata?.id === permit.s3MetadataId);
        if (!file && !existingPermit) throw new AppError("S3_METADATA_NOT_FOUND", 404);

        return { file, existingPermit, sortOrder: index + 1 };
    });
    // 同じ既存レコードへの更新が重ならないよう、新規優先で解決した後にも確認する。
    const existingPermitIds = resolvedPermits.flatMap(({ existingPermit }) =>
        existingPermit ? [existingPermit.id] : [],
    );
    if (new Set(existingPermitIds).size !== existingPermitIds.length) {
        throw new AppError("INVALID_BODY", 400);
    }

    const uploadedObjects: UploadedObject[] = [];
    let committed = false;

    try {
        if (frontIdCard) {
            const uploaded = await uploadS3Object({
                bucketName: buckets.verificationDocuments,
                objectKey: `idcard/front/${shopSignupId}/${now}_${frontIdCard.fileName}`,
                body: frontIdCard.buffer,
                contentType: frontIdCard.contentType,
            });
            uploadedObjects.push({
                ...uploaded,
                type: "idCardFront",
                originalFileName: frontIdCard.fileName,
                contentType: frontIdCard.contentType,
                fileSize: frontIdCard.size,
            });
        }

        if (rearIdCard) {
            const uploaded = await uploadS3Object({
                bucketName: buckets.verificationDocuments,
                objectKey: `idcard/rear/${shopSignupId}/${now}_${rearIdCard.fileName}`,
                body: rearIdCard.buffer,
                contentType: rearIdCard.contentType,
            });
            uploadedObjects.push({
                ...uploaded,
                type: "idCardRear",
                originalFileName: rearIdCard.fileName,
                contentType: rearIdCard.contentType,
                fileSize: rearIdCard.size,
            });
        }

        const permitUploadResults = await Promise.allSettled(
            resolvedPermits.map(async ({ file, sortOrder }) => {
                if (!file) return;
                const uploaded = await uploadS3Object({
                    bucketName: buckets.verificationDocuments,
                    objectKey: `permit/${shopSignupId}/${now}_${sortOrder}_${file.fileName}`,
                    body: file.buffer,
                    contentType: file.contentType,
                });
                uploadedObjects.push({
                    ...uploaded,
                    type: "permit",
                    originalFileName: file.fileName,
                    contentType: file.contentType,
                    fileSize: file.size,
                    sortOrder,
                });
            }),
        );

        const failedPermitUpload = permitUploadResults.find((result) => result.status === "rejected");
        if (failedPermitUpload?.status === "rejected") throw failedPermitUpload.reason;

        await sequelize.transaction(async (transaction) => {
            let frontS3MetadataId = oldFront?.id;
            let rearS3MetadataId = oldRear?.id;
            const permitMetadataIds = new Map<number, number>();

            for (const uploadedObject of uploadedObjects) {
                const metadata = await createS3Metadata({
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
                });
                if (uploadedObject.type === "idCardFront") frontS3MetadataId = metadata.id;
                else if (uploadedObject.type === "idCardRear") rearS3MetadataId = metadata.id;
                else permitMetadataIds.set(uploadedObject.sortOrder, metadata.id);
            }

            if (!frontS3MetadataId || !rearS3MetadataId) throw new AppError("S3_METADATA_NOT_FOUND", 404);

            const idCardData = {
                front_s3_metadata_id: frontS3MetadataId,
                rear_s3_metadata_id: rearS3MetadataId,
            };
            if (idCard) {
                if (frontIdCard || rearIdCard) {
                    await updateIdCardS3Metadata({ idCard, data: idCardData, transaction });
                }
            } else {
                const newIdCard = await createIdCard({ data: idCardData, transaction });
                await updateSignup3({ shopSignup, data: { idcard_id: newIdCard.id }, transaction });
            }

            for (const { existingPermit, sortOrder } of resolvedPermits) {
                const s3MetadataId = permitMetadataIds.get(sortOrder) ?? existingPermit?.S3Metadata?.id;
                if (!s3MetadataId) throw new AppError("S3_METADATA_NOT_FOUND", 404);

                if (existingPermit) {
                    await updatePermit({
                        permit: existingPermit,
                        data: { s3_metadata_id: s3MetadataId, sort_order: sortOrder },
                        transaction,
                    });
                } else {
                    await createPermit({
                        data: {
                            s3_metadata_id: s3MetadataId,
                            sort_order: sortOrder,
                            document_name: null,
                            memo: null,
                            permit_number: null,
                            permit_type: null,
                            issued_at: null,
                            expired_at: null,
                            shop_info_id: null,
                            shop_info_edit_id: null,
                            shop_signup_id: shopSignupId,
                        },
                        transaction,
                    });
                }
            }

            // 外部キーの参照を更新・解除してから、使わなくなったメタデータだけを削除する。
            for (const oldPermit of oldPermits) {
                const resolved = resolvedPermits.find(({ existingPermit }) => existingPermit?.id === oldPermit.id);
                if (!resolved) await deletePermit({ permit: oldPermit, transaction });
                if ((!resolved || resolved.file) && oldPermit.S3Metadata) {
                    await deleteS3Metadata({ s3Metadata: oldPermit.S3Metadata, transaction });
                }
            }
            if (frontIdCard && oldFront) await deleteS3Metadata({ s3Metadata: oldFront, transaction });
            if (rearIdCard && oldRear) await deleteS3Metadata({ s3Metadata: oldRear, transaction });
        });
        committed = true;
    } catch (err) {
        if (!committed) {
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
                if (result.status === "rejected") {
                    console.error("S3補償削除失敗:", result.reason);
                }
            }
        }
        throw err;
    }
};
