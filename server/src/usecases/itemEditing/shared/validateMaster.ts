import { AppError } from "../../../errors.js";
import { getCategories } from "../../../services/categories.js";
import { getItemCondition } from "../../../services/itemConditionOption.js";
import { getShippingDay } from "../../../services/shippingDayOption.js";
import { getShippingService } from "../../../services/shippingServiceOption.js";
import { getTodouhuken } from "../../../services/todouhuken.js";

type Params = {
    categoryId: number | null;
    conditionId: number | null;
    dayId: number | null;
    serviceId: number | null;
    placeId: number | null;
};

// マスターテーブルチェック
export const validateMaster = async ({ categoryId, conditionId, dayId, serviceId, placeId }: Params) => {
    let categoryOption = null;
    if (categoryId !== null && categoryId !== 0) {
        categoryOption = await getCategories({ categoryId });
        if (!categoryOption) {
            throw new AppError("CATEGORY_NOT_FOUND", 404);
        }
    }

    if (conditionId !== null && conditionId !== 0) {
        const conditionOption = await getItemCondition({ conditionId });
        if (!conditionOption) {
            throw new AppError("ITEM_CONDITION_NOT_FOUND", 404);
        }
    }

    if (dayId !== null && dayId !== 0) {
        const dayOption = await getShippingDay({ dayId });
        if (!dayOption) {
            throw new AppError("SHIPPING_DAY_NOT_FOUND", 404);
        }
    }

    if (serviceId !== null && serviceId !== 0) {
        const serviceOption = await getShippingService({ serviceId });
        if (!serviceOption) {
            throw new AppError("SHIPPING_SERVICE_NOT_FOUND", 404);
        }
    }

    if (placeId !== null && placeId !== 0) {
        const placeOption = await getTodouhuken({ todouhukenId: placeId });
        if (!placeOption) {
            throw new AppError("PLACE_NOT_FOUND", 404);
        }
    }

    return categoryOption;
};
