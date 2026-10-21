import { AppError } from "../../errors.js";
import type { ItemUploadSharedUseCaseBody } from "./bodyType.js";

const MAX_ID = 2147483647;

type Params = {
    body: ItemUploadSharedUseCaseBody;
};

const toNullableId = (value: string | null): number | null => {
    if (value === null || value.trim() === "") return null;

    const id = Number(value);
    if (!Number.isInteger(id) || id < 1 || id > MAX_ID) {
        throw new AppError("INVALID_NUMBER", 400);
    }

    return id;
};

export const validateNumber = async ({ body }: Params) => {
    const { category, condition, shipping, brand } = body;

    // 数値チェック
    const categoryId = toNullableId(category.id);

    const conditionId = toNullableId(condition.id);

    const dayId = toNullableId(shipping.day);

    const serviceId = toNullableId(shipping.service);

    const placeId = toNullableId(shipping.place);

    const brandId = toNullableId(brand.id);

    return {
        categoryId,
        conditionId,
        dayId,
        serviceId,
        placeId,
        brandId,
    };
};
