import { AppError } from "../../../errors.js";
import { getAllLevel1 } from "../../../services/categories.js";
import { findAllCondition } from "../../../services/itemConditionOption.js";
import { getItemFormData } from "../../../services/items/index.js";
import { findAllShippingDay } from "../../../services/shippingDay.js";
import { findAllShippingService } from "../../../services/shippingService.js";
import { getAllTodouhuken } from "../../../services/todouhuken.js";
import { getUserHasShop } from "../../../services/users/query.js";

type Params = {
    itemId: number;
    userId: number;
};

// GET /items/:id/form-data
// summary: アップロードフォーム表示データ取得
// page: /upload
export const getFormDataUseCase = async ({ itemId, userId }: Params) => {
    // Item取得
    const item = await getItemFormData({ itemId, userId });

    if (!item) {
        throw new AppError("ITEM_NOT_FOUND", 404);
    }

    const [category, allCondition, allDay, allService, allPlace, userHasShop] = await Promise.all([
        getAllLevel1(),
        findAllCondition(),
        findAllShippingDay(),
        findAllShippingService(),
        getAllTodouhuken(),
        getUserHasShop({ userId: Number(item.seller_id) }),
    ]);

    const hasShop = !!userHasShop?.ShopInfo;

    return {
        item,
        category,
        allCondition,
        allDay,
        allService,
        allPlace,
        hasShop,
    };
};
