import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createInquiryUseCase } from "../../usecases/inquiry/create.js";
import { CreateInquiryBody } from "../../validators/body/inquiry.js";

// POST /inquiry
// summary: お問い合わせ作成
// page: /inquiry
export const inquiryPostRootController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id ?? null;

        const validatedBody = req.validatedBody as CreateInquiryBody;
        const { name, email, title, body } = validatedBody;

        await createInquiryUseCase({ userId, name, email, title, body });

        res.status(200).json({ message: "お問い合わせを送信しました！" });
    } catch (err) {
        next(err);
    }
};
