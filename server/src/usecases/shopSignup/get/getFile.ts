import { AppError } from "../../../errors.js";
import { getS3Object } from "../../../infra/aws/getS3Object.js";
import { Permit, S3Metadata } from "../../../models/index.js";
import { getMyShopSignupHasS3Data } from "../../../services/shopSignup.js";

type Params = {
    shopSignupId: number;
    s3MetadataId: number;
    userId: number;
};

// GET /shop-signup/:shopSignupId/files/:s3MetadataId
// summary: ショップ身分証アップロードページ 画像取得
// page: /shop-signup/step3/[id]
export const getSHopSignupFileUseCase = async ({ shopSignupId, s3MetadataId, userId }: Params) => {
    // shopSignup&s3Metadata取得
    const shopSignup = await getMyShopSignupHasS3Data({ shopSignupId, userId });

    if (!shopSignup) {
        throw new AppError("SHOP_SIGNUP_NOT_FOUND", 404);
    }

    const frontS3Metadata = shopSignup.IdCard?.FrontIdCard;
    const rearS3Metadata = shopSignup.IdCard?.RearIdCard;

    const permitS3Metadata =
        shopSignup.Permit?.map((permit: InstanceType<typeof Permit>) => permit.S3Metadata).filter(
            (metadata: InstanceType<typeof S3Metadata>) => metadata != null,
        ) ?? [];

    const allowedS3Metadata = [frontS3Metadata, rearS3Metadata, ...permitS3Metadata].filter(
        (metadata) => metadata != null,
    );

    const s3Metadata = allowedS3Metadata.find((metadata) => metadata.id === s3MetadataId);

    if (!s3Metadata) {
        throw new AppError("S3_METADATA_NOT_FOUND", 404);
    }

    if (!s3Metadata.bucket_name || !s3Metadata.object_key) {
        throw new AppError("S3_OBJECT_NOT_FOUND", 404);
    }

    return getS3Object({
        bucketName: s3Metadata.bucket_name,
        objectKey: s3Metadata.object_key,
        versionId: s3Metadata.version_id,
    });
};
