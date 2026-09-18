import { AppError } from "../../../errors.js";
import { getS3Object } from "../../../infra/aws/getS3Object.js";
import { Permit, S3Metadata } from "../../../models/index.js";
import { getMyShopEditHasS3Data } from "../../../services/shopInfoEdit/query.js";

type Params = {
    shopEditId: number;
    s3MetadataId: number;
    userId: number;
};

// GET /shop-info-edit/:shopEditId/files/:s3MetadataId
// summary: 代表者氏名更新ページ 画像取得
// page: /edit/name/shop/rep-name/[id]
export const getShopEditFileUseCase = async ({ shopEditId, s3MetadataId, userId }: Params) => {
    // shopInfo取得
    const shop = await getMyShopEditHasS3Data({ shopEditId, userId });

    if (!shop) {
        throw new AppError("SHOP_NOT_FOUND", 404);
    }

    const frontS3Metadata = shop.IdCard?.FrontIdCard;
    const rearS3Metadata = shop.IdCard?.RearIdCard;

    const permitS3Metadata =
        shop.Permit?.map((permit: InstanceType<typeof Permit>) => permit.S3Metadata).filter(
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
