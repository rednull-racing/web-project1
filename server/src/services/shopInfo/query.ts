import { Op } from "sequelize";
import { Address, BankAccount, ComOrFreeOption, Name, ShopInfo, TodouhukenOption } from "../../models/index.js";
import { ShopIdParams, UserIdParams, UserShopIdParams } from "../../types/serviceType/shopInfo.js";

export const getShop = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId);
};

export const getShopHasBankAccount = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
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

export const getShopHasAddress = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "user_id"],
        include: [
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
        ],
    });
};

export const getShopHasRepName = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "id_card_front", "id_card_rear", "user_id"],
        include: [
            {
                model: Name,
                as: "RepresentativeName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getShopHasConName = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "user_id"],
        include: [
            {
                model: Name,
                as: "ContactName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getShopPhoneNumber = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "phone_number", "user_id"],
    });
};

export const getShopHasComFree = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "company_name", "com_or_free_id", "user_id"],
        include: [{ model: ComOrFreeOption }],
    });
};

export const getShopOption = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "auto_trans", "open_info", "user_id"],
    });
};

export const getShopHasAddressNameBank = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        include: [
            { model: Address },
            {
                model: Name,
                as: "RepresentativeName",
            },
            {
                model: Name,
                as: "ContactName",
            },
            { model: BankAccount },
        ],
    });
};

export const getShopIdCard = ({ shopId }: ShopIdParams) => {
    return ShopInfo.findByPk(shopId, {
        attributes: ["id", "id_card_front", "id_card_rear", "permit_url", "user_id"],
    });
};

export const getShopSignup5 = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
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
                attributes: ["sei", "mei", "sei_kana", "mei_kana"],
            },
            {
                model: Name,
                as: "ContactName",
                attributes: ["sei", "mei", "sei_kana", "mei_kana"],
            },
            {
                model: Address,
                attributes: ["post_number", "shikutyouson", "banchi", "building"],
                include: [
                    {
                        model: TodouhukenOption,
                        as: "AddressTodouhuken",
                    },
                ],
            },
            {
                model: BankAccount,
                attributes: ["bank_name", "branch_code", "account_number", "meigi", "account_type"],
            },
        ],
    });
};

export const getMyShop = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
    });
};

export const getMyShopId = ({ userId }: UserIdParams) => {
    return ShopInfo.findOne({
        attributes: ["id", "user_id"],
        where: {
            user_id: userId,
            verified: true,
        },
    });
};

export const getMyShopHasAddress = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "user_id"],
        include: [
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
        ],
    });
};

export const getMyShopHasBankAccount = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
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

export const getMyShopHasConName = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "user_id"],
        include: [
            {
                model: Name,
                as: "ContactName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getMyShopIdCard = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "id_card_front", "id_card_rear", "permit_url", "user_id"],
    });
};

export const getMyShopHasRepName = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "id_card_front", "id_card_rear", "user_id"],
        include: [
            {
                model: Name,
                as: "RepresentativeName",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getMyShopPhoneNumber = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "phone_number", "user_id"],
    });
};

export const getMyShopHasComFree = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "company_name", "com_or_free_id", "user_id"],
        include: [{ model: ComOrFreeOption }],
    });
};

export const getMyShopOption = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        attributes: ["id", "auto_trans", "open_info", "user_id"],
    });
};

export const getMyShopHasAddressNameBank = ({ shopId, userId }: UserShopIdParams) => {
    return ShopInfo.findOne({
        where: {
            id: shopId,
            user_id: userId,
        },
        include: [
            { model: Address },
            {
                model: Name,
                as: "RepresentativeName",
            },
            {
                model: Name,
                as: "ContactName",
            },
            { model: BankAccount },
        ],
    });
};

export const getOldShopAll = ({ userId, shopId }: UserShopIdParams) => {
    return ShopInfo.findAll({
        where: {
            id: { [Op.ne]: shopId },
            verified: false,
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
        ],
    });
};
