import { Transaction } from "sequelize";

import { deleteS3Object } from "../../../../infra/aws/deleteS3Object.js";
import { S3Metadata, ShopSignup } from "../../../../models/index.js";
import { deleteAddress } from "../../../../services/address.js";
import { deleteBankAccount } from "../../../../services/bankAccount.js";
import { deleteIdCard } from "../../../../services/idCard.js";
import { deleteName } from "../../../../services/name.js";
import { deletePermit } from "../../../../services/permit.js";
import { deleteS3Metadata } from "../../../../services/s3Metadata.js";

type Params = {
    oldShopSignup: InstanceType<typeof ShopSignup>[];
    transaction: Transaction;
};

export const deleteOldShopSignup = async ({ oldShopSignup, transaction }: Params) => {
    await Promise.all(
        oldShopSignup.map(async (oldData: InstanceType<typeof ShopSignup>) => {
            if (oldData.Address) {
                await deleteAddress({ address: oldData.Address, transaction });
            }

            if (oldData.RepresentativeName) {
                await deleteName({ name: oldData.RepresentativeName, transaction });
            }

            if (oldData.ContactName) {
                await deleteName({ name: oldData.ContactName, transaction });
            }

            if (oldData.BankAccount) {
                await deleteBankAccount({ account: oldData.BankAccount, transaction });
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

                    await deleteS3Metadata({ s3Metadata, transaction });
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
                        transaction,
                    });
                }

                await deleteIdCard({ idCard, transaction });
            }

            if (oldData.Permit) {
                const permit = oldData.Permit;
                const s3MetadataList = permit.S3Metadata;

                if (s3MetadataList.length > 0) {
                    await Promise.all(
                        s3MetadataList.map(async (s3Metadata: InstanceType<typeof S3Metadata>) => {
                            deleteS3Object({
                                bucketName: s3Metadata.bucket_name,
                                objectKey: s3Metadata.object_key,
                                versionId: s3Metadata.version_id,
                            });

                            await deleteS3Metadata({ s3Metadata, transaction });
                        }),
                    );
                }

                await deletePermit({ permit, transaction });
            }
        }),
    );
};
