import { ShopSignup } from "../../models/index.js";
import {
    CreateShopSignupParams,
    UpdateBankAccountParams,
    UpdateOptionParams,
    UpdateShopSignupAnyParams,
    UpdateShopSignupIdCardParams,
    UpdateShopSignupRequestAllParams,
    UpdateSignup3Params,
} from "../../types/serviceType/shopSignup.js";

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

export const updateShopSignupIdCard = async ({ shopSignup, data, transaction }: UpdateShopSignupIdCardParams) => {
    await shopSignup.update(data, { transaction });
};
