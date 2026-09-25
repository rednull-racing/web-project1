import { Op } from "sequelize";
import {
    Address,
    BankAccount,
    GenderOption,
    IdCard,
    Name,
    PointLots,
    S3Metadata,
    ShopInfo,
    TodouhukenOption,
    UriagekinLots,
    User,
} from "../../models/index.js";
import {
    EmailParams,
    GetCronUserTrustScoreParams,
    GetMyPageParams,
    GetUserAllParams,
    UserIdParams,
    UserIdWhereParams,
} from "../../types/serviceType/users.js";

export const getCronUserTrustScore = ({ createdBefore, reportTrustScore }: GetCronUserTrustScoreParams) => {
    return User.findAll({
        where: {
            createdAt: { [Op.lt]: createdBefore },
            report_trust_score: reportTrustScore,
        },
    });
};

export const getUser = ({ userId }: UserIdParams) => {
    return User.findByPk(userId);
};

export const getUserAll = ({ where, limit }: GetUserAllParams) => {
    return User.findAll({
        where,
        order: [["id", "ASC"]],
        limit,
    });
};

export const getUserHasShop = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [
            {
                model: ShopInfo,
                where: { verified: true },
                required: false,
            },
        ],
    });
};

export const getUserHasAddress = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
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
        ],
    });
};

export const getUserHasBankAccount = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
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
            },
        ],
    });
};

export const getUserHasName = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [
            {
                model: Name,
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getUserHasAddressNameId = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [
            {
                model: Address,
                include: [
                    {
                        model: TodouhukenOption,
                        as: "AddressTodouhuken",
                    },
                ],
            },
            { model: Name },
            { model: IdCard },
        ],
    });
};

export const getUserHasUriagekinPointLots = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [{ model: UriagekinLots }, { model: PointLots }],
    });
};

export const getUserHasLogicalDeleteSet = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [
            { model: UriagekinLots },
            { model: PointLots },
            { model: ShopInfo },
            { model: Name },
            { model: Address },
            { model: IdCard },
            { model: BankAccount },
        ],
    });
};

export const getUserHasUriagekin = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [{ model: UriagekinLots }],
    });
};

export const getUserHasUriagekinPointBank = async ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        include: [{ model: UriagekinLots }, { model: BankAccount }, { model: PointLots }],
    });
};

export const getMeHighlight = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "user_name", "profile_image"],
    });
};

export const getProfileMetadata = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["user_name", "user_introduction"],
    });
};

export const getStar = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["star_average"],
    });
};

export const getInquiryUser = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "user_name", "email"],
    });
};

export const getMePhoneNumber = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "phone_number"],
    });
};

export const getMeMypage = ({ userId, pointLotsWhere, uriagekinLotsWhere, order }: GetMyPageParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "user_name", "profile_image", "early_seller", "honnin_verified", "points", "uriagekin"],
        include: [
            {
                model: ShopInfo,
                where: { verified: true },
                attributes: ["id"],
                required: false,
            },
            {
                model: PointLots,
                attributes: ["id", "points", "used_points", "expires_at"],
                where: pointLotsWhere,
                order,
                limit: 1,
                separate: true,
                required: false,
            },
            {
                model: UriagekinLots,
                attributes: ["id", "uriagekin", "used_uriagekin", "expires_at"],
                where: uriagekinLotsWhere,
                order,
                limit: 1,
                separate: true,
                required: false,
            },
        ],
    });
};

export const getProfileUser = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: [
            "id",
            "user_name",
            "user_introduction",
            "profile_image",
            "early_seller",
            "honnin_verified",
            "star_amount",
            "star_average",
        ],
        include: [
            {
                model: ShopInfo,
                where: { verified: true },
                attributes: ["id"],
                required: false,
            },
        ],
    });
};

export const getProfileEditUser = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "user_name", "user_introduction", "profile_image"],
    });
};

export const getHonninEditUser = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "birthday", "phone_number", "gender_id"],
        include: [
            { model: GenderOption },
            {
                model: Address,
                attributes: ["id", "post_number", "todouhuken_id", "shikutyouson", "banchi", "building"],
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
            {
                model: IdCard,
                attributes: ["id", "id_card_front", "id_card_rear"],
            },
        ],
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

export const getMePointsWithLots = ({ userId, where, order, limit }: UserIdWhereParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "points"],
        include: [
            {
                model: PointLots,
                attributes: ["id", "points", "used_points", "expires_at"],
                where,
                order,
                limit,
                separate: true,
                required: false,
            },
        ],
    });
};

export const getMeUriagekinWithLots = ({ userId, where, order, limit }: UserIdWhereParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "uriagekin"],
        include: [
            {
                model: UriagekinLots,
                attributes: ["id", "uriagekin", "used_uriagekin", "expires_at"],
                where,
                order,
                limit,
                separate: true,
                required: false,
            },
        ],
    });
};

export const getMePointsUriage = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "points", "uriagekin"],
    });
};

export const getUserTransferRequest = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["id", "uriagekin"],
        include: [
            {
                model: BankAccount,
                attributes: ["id", "bank_name", "branch", "account_type", "account_number", "meigi"],
            },
        ],
    });
};

export const getUserPenaltyUriage = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
        attributes: ["penalty_points", "uriagekin"],
    });
};

export const getUserIdS3Metadata = ({ userId }: UserIdParams) => {
    return User.findByPk(userId, {
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
        ],
    });
};

export const getUserEmailOne = ({ email }: EmailParams) => {
    return User.findOne({
        where: { email },
    });
};

// メールアドレス被りチェック
export const getAllEmail = ({ email }: EmailParams) => {
    return User.findAll({
        where: { email },
    });
};
