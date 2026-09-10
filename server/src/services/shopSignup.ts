import { Op } from "sequelize";
import {
    Address,
    BankAccount,
    ComOrFreeOption,
    IdCard,
    Name,
    Permit,
    S3Metadata,
    ShopSignup,
    TodouhukenOption,
    User,
} from "../models/index.js";
import {
    CreateShopSignupParams,
    UpdateBankAccountParams,
    UpdateOptionParams,
    UpdateShopSignupAnyParams,
    UpdateShopSignupRequestAllParams,
    UpdateSignup3Params,
    UserIdParams,
    UserShopSignupIdParams,
} from "../types/serviceType/shopSignup.js";

export const getShopSignup1One = ({ userId }: UserIdParams) => {
    return ShopSignup.findOne({
        attributes: [
            "id",
            "company_name",
            "shop_name",
            "email",
            "phone_number",
            "homepage_url",
            "open_date_time",
            "company_number",
            "capital",
            "member_count",
            "founded_date",
            "user_id",
        ],
        where: {
            user_id: userId,
            request_all: false,
        },
        order: [["createdAt", "DESC"]],
        include: [
            {
                model: ComOrFreeOption,
                required: false,
            },
            {
                model: Address,
                attributes: ["id", "post_number", "shikutyouson", "banchi", "building"],
                include: [
                    {
                        model: TodouhukenOption,
                        as: "AddressTodouhuken",
                        required: false,
                    },
                ],
                required: false,
            },
            {
                model: Name,
                as: "RepresentativeName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
                required: false,
            },
            {
                model: Name,
                as: "ContactName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
                required: false,
            },
        ],
        require: false,
    });
};

export const getUserShopSignup1 = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "user_name", "email", "phone_number"],
        include: [
            {
                model: Address,
                attributes: ["id", "post_number", "shikutyouson", "banchi", "building"],
                include: [
                    {
                        model: TodouhukenOption,
                        as: "AddressTodouhuken",
                    },
                ],
            },
            {
                model: Name,
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getMyShopSignup = ({ shopSignupId, userId }: UserShopSignupIdParams) => {
    return ShopSignup.findOne({
        where: {
            id: shopSignupId,
            user_id: userId,
        },
    });
};

export const getMyShopSignupHasBankAccount = ({ shopSignupId, userId }: UserShopSignupIdParams) => {
    return ShopSignup.findOne({
        where: {
            id: shopSignupId,
            user_id: userId,
        },
        attributes: ["id", "user_id"],
        include: [
            {
                model: BankAccount,
                attributes: [
                    "id",
                    "bank_name",
                    "branch",
                    "account_type",
                    "account_number",
                    "meigi",
                    "bank_code",
                    "branch_code",
                ],
                required: false,
            },
        ],
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
                        model: S3Metadata,
                        required: false,
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
                        model: S3Metadata,
                        required: false,
                    },
                ],
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

export const updateShopSignupRequestAll = async ({
    shopSignup,
    data,
    transaction,
}: UpdateShopSignupRequestAllParams) => {
    await shopSignup.update(data, { transaction });
};
