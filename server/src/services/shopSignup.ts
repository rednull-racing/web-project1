import { Op } from "sequelize";
import { Address, BankAccount, IdCard, Name, Permit, PermitFile, S3Metadata, ShopSignup } from "../models/index.js";
import {
    CreateShopSignupParams,
    UpdateBankAccountParams,
    UpdateOptionParams,
    UpdateShopSignupAnyParams,
    UpdateSignup3Params,
    UserShopSignupIdParams,
} from "../types/serviceType/shopSignup.js";

export const getMyShopSignup = ({ shopSignupId, userId }: UserShopSignupIdParams) => {
    return ShopSignup.findOne({
        where: {
            id: shopSignupId,
            user_id: userId,
        },
    });
};

export const getMyShopSignupHasS3Data = ({ shopSignupId, userId }: UserShopSignupIdParams) => {
    return ShopSignup.findOne({
        where: {
            id: shopSignupId,
            user_id: userId,
        },
        include: [
            {
                model: IdCard,
                required: false,
                include: [
                    {
                        model: S3Metadata,
                        as: "FrontIdCard",
                        required: false,
                    },
                    {
                        model: S3Metadata,
                        as: "RearIdCard",
                        required: false,
                    },
                ],
            },
            {
                model: Permit,
                required: false,
                include: [
                    {
                        model: PermitFile,
                        required: false,
                        include: [
                            {
                                model: S3Metadata,
                                required: false,
                            },
                        ],
                    },
                ],
            },
        ],
    });
};

export const getOldShopSignupAll = ({ userId, shopSignupId }: UserShopSignupIdParams) => {
    return ShopSignup.findAll({
        where: {
            id: { [Op.ne]: shopSignupId },
            user_id: userId,
        },
        include: [
            {
                model: Address,
            },
            {
                model: Name,
                as: "RepresentativeName",
            },
            {
                model: Name,
                as: "ContactName",
            },
            {
                model: BankAccount,
            },
            {
                model: IdCard,
            },
            {
                model: Permit,
            },
        ],
    });
};

export const createShopSignup = ({ data, transaction }: CreateShopSignupParams) => {
    return ShopSignup.create(data, { transaction });
};

export const updateShopSignupBankAccount = async ({ shopSignup, data, transaction }: UpdateBankAccountParams) => {
    await shopSignup.update(data, { transaction });
};

export const updateSignup3 = async ({ shopSignup, data, transaction }: UpdateSignup3Params) => {
    await shopSignup.update(data, { transaction });
};

export const updateShopSignupOption = async ({ shopSignup, data, transaction }: UpdateOptionParams) => {
    await shopSignup.update(data, { transaction });
};

export const updateShopSignupAny = async ({ shopSignup, data, transaction }: UpdateShopSignupAnyParams) => {
    await shopSignup.update(data, { transaction });
};
