import { ItemShippingProfile } from "../../models/index.js";
import type { CreateShippingParams, UpdateShippingParams } from "../../types/serviceType/itemShippingProfile.js";

export const createShipping = async ({
    data,
    transaction,
}: CreateShippingParams): Promise<InstanceType<typeof ItemShippingProfile>> => {
    return ItemShippingProfile.create(data, { transaction });
};

export const updateShipping = async ({ shipping, data, transaction }: UpdateShippingParams) => {
    await shipping.update(data, { transaction });
};
