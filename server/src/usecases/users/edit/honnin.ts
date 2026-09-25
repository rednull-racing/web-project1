import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { buckets } from "../../../infra/aws/s3.js";
import { uploadS3Object } from "../../../infra/aws/uploadS3Object.js";
import { updateAddress } from "../../../services/address.js";
import { createIdCard, deleteIdCard } from "../../../services/idCard.js";
import { updateName } from "../../../services/name.js";
import { createNotification } from "../../../services/notification.js";
import { createS3Metadata, deleteS3Metadata, getS3Metadata } from "../../../services/s3Metadata.js";
import { getTodouhukenOne } from "../../../services/todouhuken.js";
import { updateHonninUser, updateIdCardIdUser } from "../../../services/users/command.js";
import { getUserHasAddressNameId } from "../../../services/users/query.js";
import { HonninBody } from "../../../validators/body/users.js";

type Params = {
    userId: number;
    body: HonninBody;
};

// PATCH /user/honnin
// summary: 本人確認リクエスト
// page: /edit/honnin
export const editHonninUserUseCase = async ({ userId, body }: Params) => {
    const now = Date.now();

    const {
        sei,
        mei,
        seiKana,
        meiKana,
        birthday,
        postNumber,
        todouhuken,
        shikutyouson,
        banchi,
        building,
        phoneNumber,
        selectedGender,
        idFrontUpload,
        idRearUpload,
        frontIdCard,
        rearIdCard,
    } = body;

    // 空チェック
    const requiredBody = [
        sei,
        mei,
        seiKana,
        meiKana,
        birthday,
        postNumber,
        todouhuken,
        shikutyouson,
        banchi,
        phoneNumber,
        selectedGender,
        idFrontUpload,
        idRearUpload,
    ];

    if (requiredBody.some((v) => v === "" || v === undefined || v === null)) {
        throw new AppError("INVALID_BODY", 400);
    }

    const formattedBirthday = new Date(birthday);

    // user取得
    const user = await getUserHasAddressNameId({ userId });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    // 都道府県バリデーションチェック
    const todouhukenData = await getTodouhukenOne({ todouhuken });

    if (!todouhukenData) throw new AppError("TODOUHUKEN_NOT_FOUND", 404);

    const todouhukenId = todouhukenData.id;
    if (todouhukenId < 1 || todouhukenId > 47) {
        throw new AppError("INVALID_TODOUHUKEN", 400);
    }

    if (!idFrontUpload || !frontIdCard) throw new AppError("INVALID_BODY", 400);
    if (!idRearUpload || !rearIdCard) throw new AppError("INVALID_BODY", 400);

    const oldIdCard = user.IdCard ?? null;
    const oldFrontS3Metadata = oldIdCard?.front_s3_metadata_id
        ? await getS3Metadata({ s3MetadataId: oldIdCard.front_s3_metadata_id })
        : null;
    const oldRearS3Metadata = oldIdCard?.rear_s3_metadata_id
        ? await getS3Metadata({ s3MetadataId: oldIdCard.rear_s3_metadata_id })
        : null;

    const uploadedObjects: Array<{
        bucketName: string;
        objectKey: string;
        versionId: string | null;
        etag: string | null;
        fileName: string;
        contentType: string;
        size: number;
        type: "front" | "rear";
    }> = [];
    let committed = false;

    try {
        const uploadedFront = await uploadS3Object({
            bucketName: buckets.verificationDocuments,
            objectKey: `idcard/front/${userId}/${now}_${frontIdCard.fileName}`,
            body: frontIdCard.buffer,
            contentType: frontIdCard.contentType,
        });
        uploadedObjects.push({ ...uploadedFront, ...frontIdCard, type: "front" });

        const uploadedRear = await uploadS3Object({
            bucketName: buckets.verificationDocuments,
            objectKey: `idcard/rear/${userId}/${now}_${rearIdCard.fileName}`,
            body: rearIdCard.buffer,
            contentType: rearIdCard.contentType,
        });
        uploadedObjects.push({ ...uploadedRear, ...rearIdCard, type: "rear" });

        await sequelize.transaction(async (t) => {
            let frontS3MetadataId: number | null = null;
            let rearS3MetadataId: number | null = null;

            for (const uploadedObject of uploadedObjects) {
                const s3Metadata = await createS3Metadata({
                    data: {
                        bucket_name: uploadedObject.bucketName,
                        object_key: uploadedObject.objectKey,
                        version_id: uploadedObject.versionId,
                        original_file_name: uploadedObject.fileName,
                        content_type: uploadedObject.contentType,
                        file_size: uploadedObject.size,
                        etag: uploadedObject.etag,
                    },
                    transaction: t,
                });

                if (uploadedObject.type === "front") frontS3MetadataId = s3Metadata.id;
                if (uploadedObject.type === "rear") rearS3MetadataId = s3Metadata.id;
            }

            if (!frontS3MetadataId || !rearS3MetadataId) throw new AppError("INVALID_BODY", 400);

            const newIdCard = await createIdCard({
                data: {
                    front_s3_metadata_id: frontS3MetadataId,
                    rear_s3_metadata_id: rearS3MetadataId,
                },
                transaction: t,
            });

            await updateIdCardIdUser({
                user,
                data: { idcard_id: newIdCard.id },
                transaction: t,
            });

            if (oldIdCard) await deleteIdCard({ idCard: oldIdCard, transaction: t });

            if (user.Address) {
                await updateAddress({
                    address: user.Address,
                    data: {
                        post_number: postNumber,
                        todouhuken_id: todouhukenId,
                        shikutyouson: shikutyouson,
                        banchi: banchi,
                        building: building,
                    },
                    transaction: t,
                });
            }

            if (user.Name) {
                await updateName({
                    name: user.Name,
                    data: {
                        sei: sei,
                        mei: mei,
                        sei_kana: seiKana,
                        mei_kana: meiKana,
                    },
                    transaction: t,
                });
            }

            await updateHonninUser({
                user,
                data: {
                    honnin_verify_request: true,
                    honnin_verified: false,
                    birthday: formattedBirthday,
                    phone_number: phoneNumber,
                    gender_id: Number(selectedGender),
                },
                transaction: t,
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

    const replacedS3Metadata = [oldFrontS3Metadata, oldRearS3Metadata].filter((s3Metadata) => s3Metadata !== null);

    if (replacedS3Metadata.length > 0) {
        await sequelize.transaction(async (t) => {
            for (const s3Metadata of replacedS3Metadata) {
                await deleteS3Metadata({ s3Metadata, transaction: t });
            }
        });

        await Promise.allSettled(
            replacedS3Metadata.map((s3Metadata) =>
                deleteS3Object({
                    bucketName: s3Metadata.bucket_name,
                    objectKey: s3Metadata.object_key,
                    versionId: s3Metadata.version_id,
                }),
            ),
        );
    }

    // お知らせ作成
    createNotification({
        data: {
            read_user_id: userId,
            message:
                "本人確認を開始しました。本人確認の完了には1~2週間程度お時間を要する場合がございます。完了までしばらくお待ちください。",
            type: "USER_EDIT",
        },
    }).catch((err) => {
        console.error("service createNotification error:", err);
    });
};
