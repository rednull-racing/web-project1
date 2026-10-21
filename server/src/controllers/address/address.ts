import type { NextFunction, Request, Response } from "express-serve-static-core";
import { AppError } from "../../errors.js";
import { editAddressUseCase } from "../../usecases/address/editAddress.js";
import { fetchAddressFromZipUseCase } from "../../usecases/address/zipUseCase.js";
import { AddressBody } from "../../validators/body/address.js";
import { ZipcodeQuery } from "../../validators/query/address.js";

// PATCH /address/:id
// summary: 住所変更
// page: /edit/addressなど
export const addressPatchByIdController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const addressId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as AddressBody;

        const { postNumber, todouhuken, shikutyouson, banchi, building } = body;

        await editAddressUseCase({ userId, addressId, postNumber, todouhuken, shikutyouson, banchi, building });

        res.status(200).json({ message: "住所を更新しました。" });
    } catch (err) {
        next(err);
    }
};

// GET /address/search
// summary: 住所検索
// page: /edit/addressなど
export const addressGetSearchController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const query = req.validatedQuery as ZipcodeQuery;

        const zipcode = query.zipcode;

        if (!zipcode) throw new AppError("INVALID_ZIPCODE", 400);

        const address = await fetchAddressFromZipUseCase({ zipcode });

        res.status(200).json({ address });
    } catch (err) {
        next(err);
    }
};
