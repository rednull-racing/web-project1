import { AppError } from "../../errors.js";
import { getMyDeliveryHasAddress } from "../../services/delivery/delivery.js";

type Params = {
    deliveryId: number;
    userId: number;
};

// GET /delivery/:id/address
// summary: 配送用住所取得
// page:
export const getDeliveryAddressUseCase = async ({ deliveryId, userId }: Params) => {
    const delivery = await getMyDeliveryHasAddress({ deliveryId, userId });

    if (!delivery) throw new AppError("DELIVERY_DATA_NOT_FOUND", 404);

    const address = delivery.Address;

    if (!address) throw new AppError("ADDRESS_NOT_FOUND", 404);

    return address;
};
