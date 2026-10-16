import { ShippingDayOption } from "../../models/index.js";

export const findAllShippingDay = async () => {
    return ShippingDayOption.findAll();
};
