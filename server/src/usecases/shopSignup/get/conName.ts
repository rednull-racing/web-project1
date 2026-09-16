type Params = {
    shopSignupId: number;
    userId: number;
};

// GET /shop-info/:id/con-name
// summary: 担当者氏名取得
// page: /edit/name/shop/con-name/signup/[id]
export const getShopSignupConNameUseCase = async ({ shopSignupId, userId }: Params) => {
    // shopSignup取得
};
