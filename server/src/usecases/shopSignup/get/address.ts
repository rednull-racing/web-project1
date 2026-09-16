type Params = {
    shopSignupId: number;
    userId: number;
};

// GET /shop-signup/:id/address
// summary: 会社所在地取得
// page: /edit/address/shop/signup/[id]
export const getAddressShopUseCase = async ({ shopSignupId, userId }: Params) => {
    // shopSignup取得
    const shopSIgnup = await 
};
