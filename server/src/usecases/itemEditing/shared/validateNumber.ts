import { toNullableNumber } from "../../../utils/toNullableNumber.js";
import { ItemUploadBody } from "../../../validators/body/items.js";

type Params = {
    body: ItemUploadBody;
};

export const validateNumber = async ({ body }: Params) => {
    const { category, condition, shipping, brand } = body;

    // 数値チェック
    const categoryId = toNullableNumber(category.id);

    const conditionId = toNullableNumber(condition.id);

    const dayId = toNullableNumber(shipping.day);

    const serviceId = toNullableNumber(shipping.service);

    const placeId = toNullableNumber(shipping.place);

    const brandId = toNullableNumber(brand.id);

    return {
        categoryId,
        conditionId,
        dayId,
        serviceId,
        placeId,
        brandId,
    };
};
