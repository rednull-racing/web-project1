import type { Transaction } from "sequelize";
import { ShippingServiceOption } from "../../models/index.js";

type ShippingServiceIdParams = {
    serviceId: number;
    transaction?: Transaction;
};

export const getShippingService = ({ serviceId, transaction }: ShippingServiceIdParams) => {
    return transaction ? ShippingServiceOption.findByPk(serviceId, { transaction }) : ShippingServiceOption.findByPk(serviceId);
};
