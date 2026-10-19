import type { Transaction } from "sequelize";
import type { ItemShippingProfile } from "../../models/index.js";

export type CreateShippingParams = {
    data: Pick<
        InstanceType<typeof ItemShippingProfile>,
        "shipping_day_id" | "shipping_service_id" | "shipping_place_id" | "shipping_service_free_text"
    >;
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
