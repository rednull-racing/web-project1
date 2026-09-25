import { AppError } from "../../../errors.js";
import { getS3Object } from "../../../infra/aws/getS3Object.js";
import { getUserIdS3Metadata } from "../../../services/users/query.js";

type Params = {
    s3MetadataId: number;
    userId: number;
};

// GET /user/files/:s3MetadataId
// summary: 本人確認入力ページ 身分証画像取得
// page: /edit/honnin
export const getUserIdCardFileUseCase = async ({ s3MetadataId, userId }: Params) => {
    // user取得
    const user = await getUserIdS3Metadata({ userId });

    if (!user) {
        throw new AppError("USER_NOT_FOUND", 404);
    }

    const frontS3Metadata = user.IdCard?.FrontIdCard;
    const rearS3Metadata = user.IdCard?.RearIdCard;

    const allowedS3Metadata = [frontS3Metadata, rearS3Metadata].filter((metadata) => metadata != null);

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
