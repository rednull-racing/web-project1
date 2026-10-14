import { Transaction } from "sequelize";
import { ItemShippingProfile } from "../../models/index.js";

export type CreateShippingParams = {
    itemId: number;
    transaction: Transaction;
};

export type UpdateShippingParams = {
    shipping: InstanceType<typeof ItemShippingProfile>;
    data: {
        shipping_day_id: number | null;
        shipping_service_id: number | null;
        shipping_place_id: number | null;
        shipping_service_free_text: string | null;
    };
    transaction: Transaction;
};
