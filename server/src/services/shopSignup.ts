import { Op } from "sequelize";
import type IdCardModel from "../models/id_card.js";
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
import type PermitModel from "../models/permit.js";
import type S3MetadataModel from "../models/s3_metadata.js";
import type ShopSignupModel from "../models/shop_signup.js";
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

type ShopSignupWithS3Data = ShopSignupModel & {
    IdCard?: (IdCardModel & { FrontIdCard?: S3MetadataModel | null; RearIdCard?: S3MetadataModel | null }) | null;
    Permit?: (PermitModel & { S3Metadata?: S3MetadataModel | null })[];
};

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

export const getShopSignup3 = ({ shopSignupId, userId }: UserShopSignupIdParams) => {
    return ShopSignup.findOne({
        where: {
            id: shopSignupId,
            user_id: userId,
        },
        attributes: ["id"],
        include: [
            {
                model: IdCard,
                attributes: ["id"],
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
                attributes: ["id"],
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

export const getShopSignup5 = ({ shopSignupId, userId }: UserShopSignupIdParams) => {
    return ShopSignup.findOne({
        where: {
            id: shopSignupId,
            user_id: userId,
        },
        attributes: [
            "id",
            "company_name",
            "shop_name",
            "phone_number",
            "email",
            "open_date_time",
            "founded_date",
            "member_count",
            "homepage_url",
            "company_number",
            "capital",
            "auto_trans",
            "open_info",
            "user_id",
        ],
        include: [
            {
                model: ComOrFreeOption,
            },
            {
                model: Name,
                as: "RepresentativeName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
            {
                model: Name,
                as: "ContactName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
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
                model: BankAccount,
                attributes: ["id", "bank_name", "branch_code", "account_number", "meigi", "account_type"],
            },
        ],
    });
};

export const getMyShopSignupHasS3Data = ({
    shopSignupId,
    userId,
}: UserShopSignupIdParams): Promise<ShopSignupWithS3Data | null> => {
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
