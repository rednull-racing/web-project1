import type { NextFunction, Request, Response } from "express-serve-static-core";
import { getDeliveryAddressUseCase } from "../../usecases/delivery/getAddress.js";
import { getDeliveryNameUseCase } from "../../usecases/delivery/getName.js";

// GET /delivery/:id/address
// summary: 配送用住所取得
// page:
export const deliveryGetByIdAddressController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const deliveryId = Number(req.params.id);
        const userId = req.user!.id;

        const data = await getDeliveryAddressUseCase({ deliveryId, userId });

        res.status(200).json({ data });
    } catch (err) {
        next(err);
    }
};

// GET /delivery/:id/name
// summary: 配送用氏名取得
// page:
export const deliveryGetByIdNameController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const deliveryId = Number(req.params.id);
        const userId = req.user!.id;

        const name = await getDeliveryNameUseCase({ deliveryId, userId });

        res.status(200).json({ name });
    } catch (err) {
        next(err);
    }
};
