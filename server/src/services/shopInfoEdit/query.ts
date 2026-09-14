import {
    Address,
    BankAccount,
    ComOrFreeOption,
    IdCard,
    Name,
    Permit,
    S3Metadata,
    ShopInfo,
    ShopInfoEdit,
    TodouhukenOption,
} from "../../models/index.js";
import { ShopEditIdParams, ShopEditUserIdParams } from "../../types/serviceType/shopInfoEdit.js";

export const getShopEdit = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId);
};

export const getMyShopEdit = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
            user_id: userId,
        },
    });
};

export const getShopEditHasShop = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId, {
        include: [{ model: ShopInfo }],
    });
};

export const getMyShopEditHasShop = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
            user_id: userId,
        },
        include: [
            { model: ShopInfo },
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

export const getShopEditHasBankAccount = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId, {
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
            },
        ],
    });
};

export const getShopEditHasAddress = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId, {
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

export const getShopEditHasRepName = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId, {
        attributes: ["id", "user_id"],
        include: [
            {
                model: Name,
                as: "RepresentativeNameEdit",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getShopEditHasConName = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId, {
        attributes: ["id", "user_id"],
        include: [
            {
                model: Name,
                as: "ContactNameEdit",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getShopEditComFreeConfirm = ({ shopEditId }: ShopEditIdParams) => {
    return ShopInfoEdit.findByPk(shopEditId, {
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
            {
                model: Name,
                as: "RepresentativeNameEdit",
            },
            {
                model: Name,
                as: "ContactNameEdit",
            },
            { model: BankAccount },
            { model: ComOrFreeOption },
            {
                model: ShopInfo,
                attributes: [
                    "id",
                    "company_name",
                    "email",
                    "phone_number",
                    "homepage_url",
                    "open_date_time",
                    "company_number",
                    "capital",
                    "member_count",
                ],
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
                    {
                        model: Name,
                        as: "RepresentativeName",
                    },
                    {
                        model: Name,
                        as: "ContactName",
                    },
                    { model: BankAccount },
                    { model: ComOrFreeOption },
                ],
            },
        ],
    });
};

export const getMyShopEditHasAddress = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
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

export const getMyShopEditHasBankAccount = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
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
            },
        ],
    });
};

export const getMyShopEditHasRepName = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
            user_id: userId,
        },
        attributes: ["id", "user_id"],
        include: [
            {
                model: Name,
                as: "RepresentativeNameEdit",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getMyShopEditHasConName = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
            user_id: userId,
        },
        attributes: ["id", "user_id"],
        include: [
            {
                model: Name,
                as: "ContactNameEdit",
                attributes: ["id", "sei", "mei", "sei_kana", "mei_kana"],
            },
        ],
    });
};

export const getMyShopEditComFreeConfirm = ({ shopEditId, userId }: ShopEditUserIdParams) => {
    return ShopInfoEdit.findOne({
        where: {
            id: shopEditId,
            user_id: userId,
        },
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
            {
                model: Name,
                as: "RepresentativeNameEdit",
            },
            {
                model: Name,
                as: "ContactNameEdit",
            },
            { model: BankAccount },
            { model: ComOrFreeOption },
            {
                model: ShopInfo,
                attributes: [
                    "id",
                    "company_name",
                    "email",
                    "phone_number",
                    "homepage_url",
                    "open_date_time",
                    "company_number",
                    "capital",
                    "member_count",
                ],
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
                    {
                        model: Name,
                        as: "RepresentativeName",
                    },
                    {
                        model: Name,
                        as: "ContactName",
                    },
                    { model: BankAccount },
                    { model: ComOrFreeOption },
                ],
            },
        ],
    });
};
