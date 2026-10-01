type Params = {
    shopId: number;
    userId: number;
};

// GET /shop-info/:id/other
// summary: その他ショップ情報取得
// page: /edit/shop/other/[id]
export const getShopOther = async ({ shopId, userId }: Params) => {
    // shopInfo取得
};
