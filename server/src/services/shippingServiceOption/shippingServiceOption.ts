import { ShippingServiceOption } from "../../models/index.js";

type ShippingServiceIdParams = {
    serviceId: number;
};

export const getShippingService = ({ serviceId }: ShippingServiceIdParams) => {
    return ShippingServiceOption.findByPk(serviceId);
};
