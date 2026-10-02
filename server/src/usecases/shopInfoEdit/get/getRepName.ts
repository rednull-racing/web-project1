import { AppError } from "../../../errors.js";
import { getMyShopEditHasRepName } from "../../../services/shopInfoEdit/query.js";

type Params = {
    shopEditId: number;
    userId: number;
};

// GET /shop-info-edit/:id/rep-name
// summary: shopEdit代表者氏名取得
// page: /edit/name/shop/rep-name/com-free/[id]
export const getRepNameEditUseCase = async ({ shopEditId, userId }: Params) => {
    const shopEdit = await getMyShopEditHasRepName({ shopEditId, userId });

    if (!shopEdit) throw new AppError("SHOP_EDIT_NOT_FOUND", 404);

    return shopEdit;
};
