import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { buckets } from "../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../infra/aws/uploadS3Object.js";
import { createIdCard, updateIdCardS3Metadata } from "../../../services/idCard.js";
import { updateName } from "../../../services/name.js";
import { createS3Metadata, deleteS3Metadata } from "../../../services/s3Metadata.js";
import { updateShopSignupIdCard } from "../../../services/shopSignup/command.js";
import { getMyShopSignupHasRepName } from "../../../services/shopSignup/query.js";
import { UpdateShopSignupRepNameBody } from "../../../validators/body/shopSignup.js";

type Params = {
    shopSignupId: number;
    body: UpdateShopSignupRepNameBody;
    userId: number;
};

type UploadedObject = Awaited<ReturnType<typeof uploadS3Object>> & {
    type: "idCardFront" | "idCardRear";
    originalFileName: string;
    contentType: string;
    fileSize: number;
};

// PATCH /shop-signup/:id/rep-name
// summary 代表者氏名変更
// page: /edit/name/shop/rep-name/signup/[id]
export const updateShopSignupRepNameUseCase = async ({ shopSignupId, body, userId }: Params): Promise<void> => {
    const now = Date.now();
    const { sei, mei, seiKana, meiKana, frontIdCard, rearIdCard } = body;
    const shopSignup = await getMyShopSignupHasRepName({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_NOT_FOUND", 404);

    const idCard = shopSignup.IdCard;
    const oldFront = idCard?.FrontIdCard;
    const oldRear = idCard?.RearIdCard;

    if (!frontIdCard && (!oldFront || oldFront.id !== body.frontS3MetadataId)) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }
    if (!rearIdCard && (!oldRear || oldRear.id !== body.rearS3MetadataId)) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }

    const uploadedObjects: UploadedObject[] = [];
    let committed = false;

    try {
        if (frontIdCard) {
            const uploaded = await uploadS3Object({
                bucketName: buckets.verificationDocuments,
                objectKey: `idcard/shop-signup/front/${shopSignupId}/${now}_${frontIdCard.fileName}`,
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
                objectKey: `idcard/shop-signup/rear/${shopSignupId}/${now}_${rearIdCard.fileName}`,
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

        await sequelize.transaction(async (transaction) => {
            let frontS3MetadataId = oldFront?.id;
            let rearS3MetadataId = oldRear?.id;

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
                await updateShopSignupIdCard({
                    shopSignup: shopSignup,
                    data: { idcard_id: newIdCard.id },
                    transaction,
                });
            }

            if (frontIdCard && oldFront) await deleteS3Metadata({ s3Metadata: oldFront, transaction });
            if (rearIdCard && oldRear) await deleteS3Metadata({ s3Metadata: oldRear, transaction });

            await updateName({
                name: shopSignup.RepresentativeName,
                data: {
                    sei,
                    mei,
                    sei_kana: seiKana,
                    mei_kana: meiKana,
                },
                transaction,
            });
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
