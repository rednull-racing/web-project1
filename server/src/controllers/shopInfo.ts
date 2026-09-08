import type { NextFunction, Request, Response } from "express-serve-static-core";
import { editShopOptionUseCase } from "../usecases/shopInfo/edit/option.js";
import { editShopPhoneNumberUseCase } from "../usecases/shopInfo/edit/phoneNumber.js";
import { updateRepNameUseCase } from "../usecases/shopInfo/edit/repName.js";
import { getAddressShopUseCase } from "../usecases/shopInfo/get/getAddress.js";
import { getBankAccountUseCase } from "../usecases/shopInfo/get/getBankAccount.js";
import { getShopComFreeUseCase } from "../usecases/shopInfo/get/getComFree.js";
import { getCompanyNameUseCase } from "../usecases/shopInfo/get/getCompanyName.js";
import { getConNameUseCase } from "../usecases/shopInfo/get/getConName.js";
import { getMyShopIdUseCase } from "../usecases/shopInfo/get/getMyShop.js";
import { getShopOptionUseCase } from "../usecases/shopInfo/get/getOption.js";
import { getShopPhoneNumberUseCase } from "../usecases/shopInfo/get/getPhoneNumber.js";
import { getRepNameUseCase } from "../usecases/shopInfo/get/getRepName.js";
import { getShopSignup1UseCase } from "../usecases/shopInfo/get/signup1.js";
import { getShopSignup2UseCase } from "../usecases/shopInfo/get/signup2.js";
import { getShopSignup3UseCase } from "../usecases/shopInfo/get/signup3.js";
import { getShopSignup5UseCase } from "../usecases/shopInfo/get/signup5.js";
import type { RepNameBody, ShopOptionBody } from "../validators/body/shopInfo.js";
import type { PhoneNumberBody } from "../validators/body/users.js";

// PATCH /shop-info/:id/rep-name
// summary 代表者氏名変更
// page: /edit/name/shop/rep-name/signup/[id]
export const shopInfoPatchByIdRepNameController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;
        const body = req.validatedBody as RepNameBody;

        const { frontSignedUrl, rearSignedUrl } = await updateRepNameUseCase({ shopId, userId, body });

        res.status(200).json({ frontSignedUrl, rearSignedUrl });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-info/:id/phone-number
// summary: 電話番号変更
// page: /edit/phone-number/shop/[id]
export const shopInfoPatchByIdPhoneNumberController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as PhoneNumberBody;
        const phoneNumber = body.phoneNumber;

        await editShopPhoneNumberUseCase({ shopId, userId, phoneNumber });

        res.status(200).json({ message: "電話番号を更新しました。" });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-info/:id/option
// summary: オプション変更
// page: /edit/shop/option/[id]
export const shopInfoPatchByIdOptionController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as ShopOptionBody;
        const { autoTrans, openInfo } = body;

        await editShopOptionUseCase({ shopId, userId, autoTrans, openInfo });

        res.status(200).json({ message: "オプションを更新しました。" });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/my
// summary: ショップのidを取得
// page: /link/edit/shop
export const shopInfoGetMyController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const shop = await getMyShopIdUseCase({ userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/address
// summary: 会社所在地取得
// page: /edit/address/shop/[id]・/edit/address/shop/signup/[id]
export const shopInfoGetByIdAddressController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const data = await getAddressShopUseCase({ shopId, userId });

        res.status(200).json({ data });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/bank-account
// summary: ショップ口座情報取得
// page: /edit/account/shop/[id]・/edit/account/shop/signup/[id]
export const shopInfoGetByIdBankAccountController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const data = await getBankAccountUseCase({ shopId, userId });

        res.status(200).json({ data });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/rep-name
// summary: 代表者氏名取得
// page: /edit/name/shop/rep-name/[id]・/edit/name/shop/rep-name/signup/[id]
export const shopInfoGetByIdRepNameController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const { shop, name } = await getRepNameUseCase({ shopId, userId });

        res.status(200).json({ shop, name });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/con-name
// summary: 担当者氏名取得
// page: /edit/name/shop/con-name/[id]・/edit/name/shop/con-name/signup/[id]
export const shopInfoGetByIdConNameController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const name = await getConNameUseCase({ shopId, userId });

        res.status(200).json({ name });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/phone-number
// summary: 電話番号取得
// page: /edit/phone-number/shop/[id]
export const shopInfoGetByIdPhoneNumberController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const shop = await getShopPhoneNumberUseCase({ shopId, userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/company-name
// summary: 会社名取得
// page: /edit/shop/company-name/[id]
export const shopInfoGetByIdCompanyNameController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const shop = await getCompanyNameUseCase({ shopId, userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/option
// summary: オプション取得
// page: /edit/shop/option/[id]
export const shopInfoGetByIdOptionController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const shop = await getShopOptionUseCase({ shopId, userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/com-free
// summary: 事業形態取得
// page: /edit/shop/com-free/[id]
export const shopInfoGetByIdComFreeController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopId = Number(req.params.id);
        const userId = req.user!.id;

        const { shop, comFree } = await getShopComFreeUseCase({ shopId, userId });

        res.status(200).json({ shop, comFree });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/signup/1
// summary: 事業者情報登録ページ インプット表示データ取得
// page: /shop-signup/step1
export const shopInfoGetSignup1Controller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const { shop, user, comFree } = await getShopSignup1UseCase({ userId });

        res.status(200).json({ shop, user, comFree });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/signup/2
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step2/[id]
export const shopInfoGetByIdSignup2Controller = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const shopId = Number(req.params.id);

        const account = await getShopSignup2UseCase({ userId, shopId });

        res.status(200).json({ account });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/signup/3
// summary: ショップ身分証登録ページ インプット表示データ取得
// page: /shop-signup/step3/[id]
export const shopInfoGetByIdSignup3Controller = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const shopId = Number(req.params.id);

        const shop = await getShopSignup3UseCase({ shopId, userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};

// GET /shop-info/:id/signup/5
// summary: ショップ登録確認ページデータ取得
// page: /shop-signup/step5/[id]
export const shopInfoGetByIdSignup5Controller = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const shopId = Number(req.params.id);

        const shop = await getShopSignup5UseCase({ shopId, userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};
