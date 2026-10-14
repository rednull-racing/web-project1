import { ItemShippingProfile } from "../models/index.js";
import { CreateShippingParams, UpdateShippingParams } from "../types/serviceType/itemShippingProfile.js";

export const createShipping = async ({ itemId, transaction }: CreateShippingParams) => {
    await ItemShippingProfile.create(
        {
            item_id: itemId,
        },
        { transaction },
    );
};

export const updateShipping = async ({ shipping, data, transaction }: UpdateShippingParams) => {
    await shipping.update(data, { transaction });
};
