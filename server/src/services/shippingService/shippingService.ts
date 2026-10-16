import { ShippingServiceOption } from "../../models/index.js";

export const findAllShippingService = async () => {
    return ShippingServiceOption.findAll();
};
