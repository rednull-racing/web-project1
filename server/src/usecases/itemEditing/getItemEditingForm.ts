import { AppError } from "../../errors.js";
import type { ItemEditing } from "../../models/item_editing.js";
import { getMyItemEditingForm } from "../../services/itemEditing/query.js";
import { getAllLevel1 } from "../../services/categories/categories.js";
import { getAllCondition } from "../../services/itemConditionOption/itemConditionOption.js";
import { getAllShippingDay } from "../../services/shippingDayOption/shippingDayOption.js";
import { getAllShippingService } from "../../services/shippingServiceOption/shippingServiceOption.js";
import { getAllTodouhuken } from "../../services/todouhukenOption/todouhukenOption.js";
import { getUserHasShop } from "../../services/users/query.js";

type Params = { itemEditingId: number; userId: number };
type Result = {
    itemEditing: ItemEditing;
    category: Awaited<ReturnType<typeof getAllLevel1>>;
    allCondition: Awaited<ReturnType<typeof getAllCondition>>;
    allDay: Awaited<ReturnType<typeof getAllShippingDay>>;
    allService: Awaited<ReturnType<typeof getAllShippingService>>;
    allPlace: Awaited<ReturnType<typeof getAllTodouhuken>>;
    hasShop: boolean;
};

// GET /item-editing/:id/form
// summary: 商品アップロード入力フォーム初期値取得
// page: /upload/[id]・/upload/edit/[id]
export const getItemEditingFormUseCase = async ({ itemEditingId, userId }: Params): Promise<Result> => {
    const itemEditing = await getMyItemEditingForm({ itemEditingId, userId });
    if (!itemEditing) throw new AppError("ITEM_EDITING_NOT_FOUND", 404);
    const [category, allCondition, allDay, allService, allPlace, userHasShop] = await Promise.all([
        getAllLevel1(),
        getAllCondition(),
        getAllShippingDay(),
        getAllShippingService(),
        getAllTodouhuken(),
        getUserHasShop({ userId }),
    ]);
    return { itemEditing, category, allCondition, allDay, allService, allPlace, hasShop: !!userHasShop?.ShopInfo };
};
