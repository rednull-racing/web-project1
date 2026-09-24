import { Name, User } from "../models/index.js";
import {
    CreateNameAllowNullParams,
    CreateNameFirstParams,
    CreateNameShopAllowNullParams,
    CreateNameShopParams,
    NameIdParams,
    NameTransactionParams,
    NameUserIdParams,
    UpdateNameParams,
    UpdateNameShopParams,
} from "../types/serviceType/name.js";

export const getName = ({ nameId }: NameIdParams) => {
    return Name.findByPk(nameId);
};

export const getMyName = ({ nameId, userId }: NameUserIdParams) => {
    return Name.findOne({
        where: {
            id: nameId,
        },
        include: [
            {
                model: User,
                where: {
                    id: userId,
                },
                attributes: [],
                required: true,
            },
        ],
    });
};

export const createNameFirst = async ({ transaction }: CreateNameFirstParams) => {
    return Name.create({ transaction });
};

export const createNameAllowNull = async ({ data, transaction }: CreateNameAllowNullParams) => {
    return Name.create(data, { transaction });
};

export const createNameShop = async ({ data, transaction }: CreateNameShopParams) => {
    return Name.create(data, { transaction });
};

export const createNameShopAllowNull = async ({ data, transaction }: CreateNameShopAllowNullParams) => {
    return Name.create(data, { transaction });
};

export const updateName = async ({ name, data, transaction }: UpdateNameParams) => {
    await name.update(data, { transaction });
};

export const updateShopName = async ({ name, data, transaction }: UpdateNameShopParams) => {
    await name.update(data, { transaction });
};

export const deleteName = async ({ name, transaction }: NameTransactionParams) => {
    await name.destroy({ transaction });
};
