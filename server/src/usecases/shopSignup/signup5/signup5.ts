import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { deleteS3Object } from "../../../infra/aws/deleteS3Object.js";
import { S3Metadata, ShopSignup } from "../../../models/index.js";
import { deleteAddress } from "../../../services/address.js";
import { deleteBankAccount } from "../../../services/bankAccount.js";
import { deleteIdCard } from "../../../services/idCard.js";
import { deleteName } from "../../../services/name.js";
import { deletePermit } from "../../../services/permit.js";
import { deleteS3Metadata } from "../../../services/s3Metadata.js";
import { getMyShopSignup, getOldShopSignupAll } from "../../../services/shopSignup.js";
import { OldShopSignup } from "./oldShopSignup.js";

type Params = {
    shopSignupId: number;
    userId: number;
};

// PATCH /shop-signup/:id/signup5
// summary: ショップ登録 確定
// page: /shop-signup/step5/[id]
export const updateShopSignup5UseCase = async ({ shopSignupId, userId }: Params) => {
    // shop取得
    const shopSignup = await getMyShopSignup({ shopSignupId, userId });

    if (!shopSignup) throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);

    // 既存承認待ちshop削除
    const oldShopSignup: OldShopSignup[] = await getOldShopSignupAll({ userId, shopSignupId });

    await sequelize.transaction(async (t) => {
        if (oldShopSignup.length > 0) {
            await Promise.all(
                oldShopSignup.map(async (oldData: InstanceType<typeof ShopSignup>) => {
                    if (oldData.Address) {
                        await deleteAddress({
                            address: oldData.Address,
                            transaction: t,
                        });
                    }

                    if (oldData.RepresentativeName) {
                        await deleteName({
                            name: oldData.RepresentativeName,
                            transaction: t,
                        });
                    }

                    if (oldData.ContactName) {
                        await deleteName({
                            name: oldData.ContactName,
                            transaction: t,
                        });
                    }

                    if (oldData.BankAccount) {
                        await deleteBankAccount({
                            account: oldData.BankAccount,
                            transaction: t,
                        });
                    }

                    if (oldData.IdCard) {
                        const idCard = oldData.IdCard;

                        if (idCard.FrontIdCard) {
                            const s3Metadata = idCard.FrontIdCard;

                            deleteS3Object({
                                bucketName: s3Metadata.bucket_name,
                                objectKey: s3Metadata.object_key,
                                versionId: s3Metadata.version_id,
                            });

                            await deleteS3Metadata({
                                s3Metadata,
                                transaction: t,
                            });
                        }

                        if (idCard.RearIdCard) {
                            const s3Metadata = idCard.RearIdCard;

                            deleteS3Object({
                                bucketName: s3Metadata.bucket_name,
                                objectKey: s3Metadata.object_key,
                                versionId: s3Metadata.version_id,
                            });

                            await deleteS3Metadata({
                                s3Metadata: idCard.RearIdCard,
                                transaction: t,
                            });
                        }

                        await deleteIdCard({
                            idCard,
                            transaction: t,
                        });
                    }

                    if (oldData.Permit) {
                        const permit = oldData.Permit;
                        const s3MetadataList = permit.PermitFile.S3Metadata;

                        if (s3MetadataList.length > 0) {
                            await Promise.all(
                                s3MetadataList.map(async (s3Metadata: InstanceType<typeof S3Metadata>) => {
                                    deleteS3Object({
                                        bucketName: s3Metadata.bucket_name,
                                        objectKey: s3Metadata.object_key,
                                        versionId: s3Metadata.version_id,
                                    });

                                    await deleteS3Metadata({
                                        s3Metadata,
                                        transaction: t,
                                    });
                                }),
                            );
                        }

                        await deletePermit({
                            permit,
                            transaction: t,
                        });
                    }
                }),
            );
        }
    });
};
