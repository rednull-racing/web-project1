import { ShippingDayOption } from "../../models/index.js";

type ShippingDayIdParams = {
    dayId: number;
};

export const getShippingDay = ({ dayId }: ShippingDayIdParams) => {
    return ShippingDayOption.findByPk(dayId);
};
