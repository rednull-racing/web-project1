import { Address, TodouhukenOption, User } from "../../models/index.js";
import {
    AddressIdParams,
    AddressTransactionParams,
    AddressUserIdParams,
    CreateAddressAllowNullParams,
    CreateAddressFirstParams,
    CreateAddressParams,
    UpdateAddressParams,
} from "../../types/serviceType/address.js";

export const getAddress = ({ addressId }: AddressIdParams) => {
    return Address.findByPk(addressId, {
        include: [
            {
                model: TodouhukenOption,
                as: "AddressTodouhuken",
            },
        ],
    });
};

export const getMyAddress = ({ addressId, userId }: AddressUserIdParams) => {
    return Address.findOne({
        where: {
            id: addressId,
        },
        include: [
            {
                model: TodouhukenOption,
                as: "AddressTodouhuken",
            },
            {
                model: User,
                where: { id: userId },
                attributes: [],
                required: true,
            },
        ],
    });
};

export const createAddressFirst = async ({ transaction }: CreateAddressFirstParams) => {
    return Address.create({ transaction });
};

export const createAddress = async ({ data, transaction }: CreateAddressParams) => {
    return Address.create(data, { transaction });
};

export const createAddressAllowNull = async ({ data, transaction }: CreateAddressAllowNullParams) => {
    return Address.create(data, { transaction });
};

export const updateAddress = async ({ address, data, transaction }: UpdateAddressParams) => {
    await address.update(data, { transaction });
};

export const deleteAddress = async ({ address, transaction }: AddressTransactionParams) => {
    await address.destroy({ transaction });
};
