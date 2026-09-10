import type { NextFunction, Request, Response } from "express-serve-static-core";
import { createShopSignup1 } from "../usecases/shopSignup/edit/signup1/signup1.js";
import { updateShopSignup2UseCase } from "../usecases/shopSignup/edit/signup2.js";
import { updateShopSignup3UseCase } from "../usecases/shopSignup/edit/signup3/signup3.js";
import { updateShopSignup4UseCase } from "../usecases/shopSignup/edit/signup4.js";
import { updateShopSignup5UseCase } from "../usecases/shopSignup/edit/signup5/signup5.js";
import { updateShopSignupEditUseCase } from "../usecases/shopSignup/edit/signup5/signupEdit.js";
import { BankBody } from "../validators/body/bankAccount.js";
import {
    CreateSignup1Body,
    ShopSignup3Body,
    ShopSignupEditBody,
    ShopSignupOptionBody,
} from "../validators/body/shopSignup.js";
import { getShopSignup1UseCase } from "../usecases/shopSignup/get/signup1.js";
import { getShopSignup2UseCase } from "../usecases/shopSignup/get/signup2.js";
import { getShopSignup3UseCase } from "../usecases/shopSignup/get/signup3.js";

// POST /shop-signup
// summary: ShopSignup作成 事業者登録
// page: /shop-signup/step1
export const shopSignupPostRootController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;
        const body = req.validatedBody as CreateSignup1Body;

        const shopId = await createShopSignup1({ userId, body });

        res.status(200).json({ shopId });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-signup/:id/bank-account
// summary: ショップ口座情報作成
// page: /shop-signup/step2
export const updateShopSignup2Controller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const shopSignupId = Number(req.params.id);
        const userId = req.user!.id;
        const body = req.validatedBody as BankBody;

        await updateShopSignup2UseCase({ shopSignupId, userId, body });

        res.status(200).json({ message: "口座情報を登録しました。" });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-signup/:id/id-card
// summary: ショップ登録身分証・許認可証追加
// page: /shop-signup/step3/[id]
export const updateShopSignup3Controller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const shopSignupId = Number(req.params.id);
        const userId = req.user!.id;
        const body = req.validatedBody as ShopSignup3Body;

        await updateShopSignup3UseCase({ shopSignupId, userId, body });

        res.status(200).json({ message: "身分証および営業許可証を登録しました。" });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-signup/:id/option
// summary: ショップ登録オプション選択
// page: /shop-signup/step4/[id]
export const updateShopSignupOptionController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopSignupId = Number(req.params.id);
        const userId = req.user!.id;

        const body = req.validatedBody as ShopSignupOptionBody;
        const { autoTrans, openInfo } = body;

        await updateShopSignup4UseCase({ shopSignupId, userId, autoTrans, openInfo });

        res.status(200).json({ message: "オプションを更新しました。" });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-signup/:id/edit
// summary: ショップ登録確認ページ インプット編集
// page: /shop-signup/step5/[id]
export const updateShopSignupEditController = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const shopSignupId = Number(req.params.id);
        const userId = req.user!.id;
        const updateData = req.validatedBody as ShopSignupEditBody;

        await updateShopSignupEditUseCase({ shopSignupId, userId, updateData });

        res.status(200).json({ message: "更新しました。", updated: updateData });
    } catch (err) {
        next(err);
    }
};

// PATCH /shop-signup/:id/signup5
// summary: ショップ登録 確定
// page: /shop-signup/step5/[id]
export const updateShopSignup5Controller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const shopSignupId = Number(req.params.id);
        const userId = req.user!.id;

        await updateShopSignup5UseCase({ shopSignupId, userId });

        res.status(200).json({ message: "ショップ登録のリクエストが完了しました！" });
    } catch (err) {
        next(err);
    }
};

// GET /shop-signup/1
// summary: 事業者情報登録ページ インプット表示データ取得
// page: /shop-signup/step1
export const getShopSignup1Controller = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user!.id;

        const { shopSignup, user, comFree } = await getShopSignup1UseCase({ userId });

        res.status(200).json({ shopSignup, user, comFree });
    } catch (err) {
        next(err);
    }
};

// GET /shop-signup/:id/2
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step2/[id]
export const getShopSignup2Controller = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const shopSignupId = Number(req.params.id);

        const account = await getShopSignup2UseCase({ userId, shopSignupId });

        res.status(200).json({ account });
    } catch (err) {
        next(err);
    }
};

// GET /shop-signup/:id/3
// summary: ショップ口座登録ページ インプット表示データ取得
// page: /shop-signup/step3/[id]
export const getShopSignup3Controller = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const userId = req.user!.id;
        const shopSignupId = Number(req.params.id);

        const shop = await getShopSignup3UseCase({ shopSignupId, userId });

        res.status(200).json({ shop });
    } catch (err) {
        next(err);
    }
};
