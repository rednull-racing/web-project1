import type { Transaction } from "sequelize";
import { ShippingDayOption } from "../../models/index.js";

type ShippingDayIdParams = {
    dayId: number;
    transaction?: Transaction;
};

export const getShippingDay = ({ dayId, transaction }: ShippingDayIdParams) => {
    return transaction ? ShippingDayOption.findByPk(dayId, { transaction }) : ShippingDayOption.findByPk(dayId);
};
