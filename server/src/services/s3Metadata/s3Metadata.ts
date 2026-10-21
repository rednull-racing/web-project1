import { S3Metadata } from "../../models/index.js";
import {
    CreateS3MetadataParams,
    S3MetadataIdParams,
    S3MetadataTransactionParams,
} from "../../types/serviceType/s3Metadata.js";

export const getS3Metadata = async ({ s3MetadataId }: S3MetadataIdParams) => {
    return S3Metadata.findByPk(s3MetadataId);
};

export const createS3Metadata = async ({ data, transaction }: CreateS3MetadataParams) => {
    return S3Metadata.create(data, { transaction });
};

export const deleteS3Metadata = async ({ s3Metadata, transaction }: S3MetadataTransactionParams) => {
    await s3Metadata.destroy({ transaction });
};
