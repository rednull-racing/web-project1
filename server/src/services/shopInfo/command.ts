import {
    ShopTransactionParams,
    UpdateBankAccountParams,
    UpdateCompanyNameParams,
    UpdateOptionParams,
    UpdateShopAnyParams,
    UpdateShopEmailParams,
    UpdateShopIdCardParams,
    UpdateShopNameParams,
    UpdateShopPhoneNumberParams,
    UpdateShopUserLogicalDeleteParams,
} from "../../types/serviceType/shopInfo.js";

export const updateShopEmail = async ({ shopInfo, data, transaction }: UpdateShopEmailParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopIdCard = async ({ shopInfo, data, transaction }: UpdateShopIdCardParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopPhoneNumber = async ({ shopInfo, data, transaction }: UpdateShopPhoneNumberParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopName = async ({ shopInfo, data, transaction }: UpdateShopNameParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopCompanyName = async ({ shopInfo, data, transaction }: UpdateCompanyNameParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopOption = async ({ shopInfo, data, transaction }: UpdateOptionParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopBankAccount = async ({ shopInfo, data, transaction }: UpdateBankAccountParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopUserLogicalDelete = async ({
    shopInfo,
    data,
    transaction,
}: UpdateShopUserLogicalDeleteParams) => {
    await shopInfo.update(data, { transaction });
};

export const updateShopAny = async ({ shopInfo, data, transaction }: UpdateShopAnyParams) => {
    await shopInfo.update(data, { transaction });
};

export const deleteShop = async ({ shopInfo, transaction }: ShopTransactionParams) => {
    await shopInfo.update({ transaction });
};
