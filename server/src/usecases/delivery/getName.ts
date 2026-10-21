import { AppError } from "../../errors.js";
import { getMyDeliveryHasName } from "../../services/delivery/delivery.js";

type Params = {
    deliveryId: number;
    userId: number;
};

// GET /delivery/:id/name
// summary: 配送用氏名取得
// page:
export const getDeliveryNameUseCase = async ({ deliveryId, userId }: Params) => {
    const delivery = await getMyDeliveryHasName({ deliveryId, userId });

    if (!delivery) throw new AppError("DELIVERY_NOT_FOUND", 404);

    const name = delivery.Name;

    if (!name) throw new AppError("NAME_NOT_FOUND", 404);

    return name;
};
