import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { buckets } from "../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../infra/aws/uploadS3Object.js";
import { createIdCard } from "../../../services/idCard.js";
import { createPermit } from "../../../services/permit.js";
import { createS3Metadata, deleteS3Metadata } from "../../../services/s3Metadata.js";
import { getMyShopSignupHasS3Data, updateSignup3 } from "../../../services/shopSignup.js";
import { ShopSignup3Body } from "../../../validators/body/shopSignup.js";
import { UploadedObject } from "./type.js";

type Params = {
    shopSignupId: number;
    userId: number;
    body: ShopSignup3Body;
};

// とりあえず最小構成でpermit系などnullable箇所をnullにしている
// フロントエンド構成変更によるロジック追加あり

// PATCH /shop-signup/:id/id-card
// summary: ショップ登録身分証・許認可証追加
// page: /shop-signup/step3/[id]
export const updateShopSignup3UseCase = async ({ shopSignupId, userId, body }: Params) => {
    const now = Date.now();

    const { frontIdCard, rearIdCard, permitFiles } = body;

    if (permitFiles.length > 10) {
        throw new AppError("OVER_MAX_PERMIT_FILE_COUNT", 400);
    }

    // shopSignup取得
    const shopSignup = await getMyShopSignupHasS3Data({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    // 既存の身分証S3Metadata
    const uploadedObjects: UploadedObject[] = [];

    let committed = false;

    try {
        // 新しいファイルをアップロード
        const frontObjectKey = `idcard/front/${shopSignupId}/${now}_${frontIdCard.fileName}`;
        const rearObjectKey = `idcard/rear/${shopSignupId}/${now}_${rearIdCard.fileName}`;

        // S3へアップロード
        // frontIdCard
        const uploadedFront = frontIdCard
            ? await uploadS3Object({
                  bucketName: buckets.verificationDocuments,
                  objectKey: frontObjectKey,
                  body: frontIdCard.buffer,
                  contentType: frontIdCard.contentType,
              })
            : null;

        if (uploadedFront) {
            uploadedObjects.push({
                ...uploadedFront,
                type: "idCardFront",
                originalFileName: frontIdCard.fileName,
                contentType: frontIdCard.contentType,
                fileSize: frontIdCard.size,
            });
        }

        // rearIdCard
        const uploadedRear = rearIdCard
            ? await uploadS3Object({
                  bucketName: buckets.verificationDocuments,
                  objectKey: rearObjectKey,
                  body: rearIdCard.buffer,
                  contentType: rearIdCard.contentType,
              })
            : null;

        if (uploadedRear) {
            uploadedObjects.push({
                ...uploadedRear,
                type: "idCardRear",
                originalFileName: rearIdCard.fileName,
                contentType: rearIdCard.contentType,
                fileSize: rearIdCard.size,
            });
        }

        const permitUploadResults = await Promise.allSettled(
            permitFiles.map(async (file, index) => {
                const sortOrder = index + 1;
                const permitObjectKey = `permit/${shopSignupId}/${now}_${file.fileName}`;

                const uploaded = await uploadS3Object({
                    bucketName: buckets.verificationDocuments,
                    objectKey: permitObjectKey,
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

        // transaction DB更新
        await sequelize.transaction(async (t) => {
            let frontIdCardS3MetadataId: number | null = null;
            let rearIdCardS3MetadataId: number | null = null;

            const permitS3MetadataList: {
                s3MetadataId: number;
                sortOrder: number;
            }[] = [];

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
                        transaction: t,
                    }),
                })),
            );

            for (const { uploadedObject, s3Metadata } of s3MetadataList) {
                if (uploadedObject.type === "idCardFront") {
                    frontIdCardS3MetadataId = s3Metadata.id;
                } else if (uploadedObject.type === "idCardRear") {
                    rearIdCardS3MetadataId = s3Metadata.id;
                } else if (uploadedObject.type === "permit") {
                    permitS3MetadataList.push({
                        s3MetadataId: s3Metadata.id,
                        sortOrder: uploadedObject.sortOrder,
                    });
                }
            }

            if (!frontIdCardS3MetadataId || !rearIdCardS3MetadataId) {
                throw new Error();
            }

            // idCard作成
            const newIdCard = await createIdCard({
                data: {
                    front_s3_metadata_id: frontIdCardS3MetadataId,
                    rear_s3_metadata_id: rearIdCardS3MetadataId,
                },
                transaction: t,
            });

            // Permit更新
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
                                shop_info_edit_id: null,
                                shop_signup_id: shopSignupId,
                            },
                            transaction: t,
                        }),
                    ),
                );
            }

            // shopSignup更新
            await updateSignup3({
                shopSignup,
                data: {
                    idcard_id: newIdCard.id,
                },
                transaction: t,
            });
        });

        committed = true;
    } catch (err) {
        // commit前だけ今回アップロードした新S3オブジェクトを補償削除
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

    // commit後なので、ここから旧S3削除
    const idCard = shopSignup.IdCard;

    const oldFrontS3Metadata = idCard?.FrontIdCard?.FrontS3Metadata ?? null;
    const oldRearS3Metadata = idCard?.RearIdCard?.RearS3Metadata ?? null;

    const oldPermitS3Metadata = shopSignup.Permit?.PermitFile?.S3Metadata ?? null;

    await sequelize.transaction(async (t) => {
        if (oldFrontS3Metadata) {
            await deleteS3Metadata({ s3Metadata: oldFrontS3Metadata, transaction: t });
        }

        if (oldRearS3Metadata) {
            await deleteS3Metadata({ s3Metadata: oldRearS3Metadata, transaction: t });
        }

        if (oldPermitS3Metadata) {
            await Promise.all(
                oldPermitS3Metadata.map((s3Metadata: Parameters<typeof deleteS3Metadata>[0]["s3Metadata"]) =>
                    deleteS3Metadata({ s3Metadata, transaction: t }),
                ),
            );
        }
    });
};
