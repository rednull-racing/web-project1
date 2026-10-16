import type { NextFunction, Request, Response } from "express-serve-static-core";
import { editAccountUseCase } from "../../usecases/bankAccount/editAccount.js";
import { BankBody } from "../../validators/body/bankAccount.js";

// PATCH /bank-account/:id
// summary: 口座情報変更
// page: /edit/account
export const bankAccountPatchByIdController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const accountId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as BankBody;

        await editAccountUseCase({
            userId,
            accountId,
            body,
        });

        res.status(200).json({ message: "口座情報を更新しました。" });
    } catch (err) {
        next(err);
    }
};
