// 複数関連モデル取得
import { Categories, Item, ItemShippingProfile, Sale, User, Video } from "../../../models/index.js";
import { ItemIdParams, UserIdParams, UserItemIdParams } from "../../../types/serviceType/items.js";
import type {
    GetMyItemWithVideoSaleShippingParams,
    ItemWithVideoSaleShipping,
    UserSaleIdParams,
} from "../../../types/serviceType/items.js";

export const getItem = ({ itemId }: ItemIdParams) => {
    return Item.findByPk(itemId);
};

export const getMyItem = ({ itemId, userId }: UserItemIdParams) => {
    return Item.findOne({
        where: {
            id: itemId,
            seller_id: userId,
        },
    });
};

export const getMyItemBySaleId = ({ saleId, userId }: UserSaleIdParams) => {
    return Item.findOne({
        attributes: ["id"],
        where: {
            sale_id: saleId,
            seller_id: userId,
        },
    });
};

export const getItemHighlight = ({ itemId }: ItemIdParams) => {
    return Item.findByPk(itemId, {
        attributes: [
            "id",
            "name",
            "price",
            "attributes",
            "first_image_url",
            "gender_type",
            "age_type",
            "seller_id",
            "status",
        ],
    });
};

export const getItemWithCategory = ({ itemId }: ItemIdParams) => {
    return Item.findByPk(itemId, {
        include: [
            {
                model: Categories,
                as: "Category",
            },
        ],
    });
};

export const getItemWithVideoSaleShipping = ({ itemId }: ItemIdParams) => {
    return Item.findByPk(itemId, {
        include: [{ model: Video }, { model: Sale }, { model: ItemShippingProfile }],
    });
};

export const getItemWithVideoCategoriesUser = ({ itemId }: ItemIdParams) => {
    return Item.findByPk(itemId, {
        include: [
            { model: Video },
            {
                model: Categories,
                as: "Category",
                include: [
                    {
                        model: Categories,
                        as: "parent",
                        required: false,
                    },
                ],
            },
            { model: User },
        ],
    });
};

export function getMyItemWithVideoSaleShipping(
    params: Required<GetMyItemWithVideoSaleShippingParams>,
): Promise<ItemWithVideoSaleShipping | null>;
export function getMyItemWithVideoSaleShipping(params: UserItemIdParams): Promise<ItemWithVideoSaleShipping | null>;
export async function getMyItemWithVideoSaleShipping({
    itemId,
    userId,
    transaction,
}: GetMyItemWithVideoSaleShippingParams): Promise<ItemWithVideoSaleShipping | null> {
    if (transaction) {
        // 関連の外部結合をロックせず、ロック待機後のデータでコピーするため、先にitemだけをロックする。
        const item = await Item.findOne({
            attributes: ["id"],
            where: { id: itemId, seller_id: userId },
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
        if (!item) return null;
    }

    const item = await Item.findOne({
        where: {
            id: itemId,
            seller_id: userId,
        },
        attributes: transaction
            ? [
                  "id",
                  "seller_id",
                  "status",
                  "name",
                  "detail",
                  "image_url",
                  "item_condition_id",
                  "first_image_url",
                  "gender_type",
                  "age_type",
                  "recommend",
                  "category_id",
                  "brand_id",
                  "brand_aliases_id",
                  "attributes",
              ]
            : undefined,
        include: transaction
            ? [
                  {
                      model: Video,
                      attributes: [
                          "thumbnail_url",
                          "title",
                          "summary",
                          "duration",
                          "original_url",
                          "converted_url",
                          "status",
                      ],
                      required: false,
                  },
                  { model: Sale, attributes: ["before_price"], required: false },
                  {
                      model: ItemShippingProfile,
                      attributes: [
                          "shipping_day_id",
                          "shipping_service_id",
                          "shipping_place_id",
                          "shipping_service_free_text",
                      ],
                      required: false,
                  },
              ]
            : [{ model: Video }, { model: Sale }, { model: ItemShippingProfile }],
        transaction,
    });

    return item as ItemWithVideoSaleShipping | null;
}

export const getMyItemWithVideoCategoriesUser = ({ itemId, userId }: UserItemIdParams) => {
    return Item.findOne({
        where: {
            id: itemId,
            seller_id: userId,
        },
        include: [
            { model: Video },
            {
                model: Categories,
                as: "Category",
                include: [
                    {
                        model: Categories,
                        as: "parent",
                        required: false,
                    },
                ],
            },
            { model: User },
        ],
    });
};

export const getMyItemsWithVideoAll = ({ userId }: UserIdParams) => {
    return Item.findAll({
        where: { seller_id: userId },
        include: [{ model: Video }],
    });
};
