import type {
    CountUpdateParams,
    ItemDataParams,
    PublishUpdateParams,
    SortUpdateParams,
    UpdateSortBuzzNumberDecayParams,
    UpdateSortNumberDecayParams,
    UpdateItemImageParams,
    UpdatePriceParams,
    UpdateReportScoreParams,
} from "../../../types/serviceType/items.js";

export const updateSortBuzzNumberDecay = async ({ item, data }: UpdateSortBuzzNumberDecayParams) => {
    await item.update(data);
};

export const updateSortNumberDecay = async ({ item, data }: UpdateSortNumberDecayParams) => {
    await item.update(data);
};

export const updateSortNumber = async ({ item, data }: SortUpdateParams) => {
    await item.update(data);
};

export const addViewsCount = async ({ item, data }: CountUpdateParams) => {
    await item.update(data);
};

export const updateRestoreItem = async ({ item }: ItemDataParams) => {
    const nowDate = new Date();

    await item.update({
        uploaded_at: nowDate,
        status: "active",
        deleted_at: null,
    });
};

export const updatePublishItem = async ({ item, data }: PublishUpdateParams) => {
    const nowDate = new Date();

    await item.update({
        status: "active",
        uploaded_at: nowDate,
        save_at: nowDate,
        early_sell: true,
        ...data,
    });
};

export const updateImage = async ({ item, urls, transaction }: UpdateItemImageParams) => {
    item.setDataValue("image_url", urls);
    item.changed("image_url", true);
    await item.save({ transaction });
};

export const updatePrice = async ({ item, data, transaction }: UpdatePriceParams) => {
    await item.update(data, { transaction });
};

export const updateReportScore = async ({ item, data, transaction }: UpdateReportScoreParams) => {
    await item.update(data, { transaction });
};
