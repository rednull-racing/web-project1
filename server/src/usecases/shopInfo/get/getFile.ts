type Params = {
    shopId: number;
    s3MetadataId: number;
    userId: number;
};

// GET /shop-info/:shopInfoId/files/:s3MetadataId
// summary: 代表者氏名更新ページ 画像取得
// page: /edit/name/shop/rep-name/[id]
export const getShopFileUseCase = async ({ shopId, s3MetadataId, userId }: Params) => {
    // shopInfo取得
};
