import { Op, QueryTypes } from "sequelize";
import type { Transaction } from "sequelize";
import sequelize from "../../../../db.js";
import { Item, Video, Sale } from "../../../../models/index.js";
import type {
    UploadedItemListRow,
    GetUploadedItemListParams,
    CountUploadedItemListParams,
} from "../../../../types/serviceType/items.js";

export const setUploadedItemListReadOnly = async ({ transaction }: { transaction: Transaction }): Promise<void> => {
    await sequelize.query("SET TRANSACTION READ ONLY", { transaction, type: QueryTypes.RAW });
};

export const getMyUploadedItemList = ({
    userId, where, limit, offset, transaction,
}: GetUploadedItemListParams): Promise<UploadedItemListRow[]> => {
    return Item.findAll({
        attributes: ["id", "name", "price", "status", "first_image_url", "gender_type", "age_type", "uploaded_at"],
        where: { [Op.and]: [{ seller_id: userId }, where] },
        limit,
        offset,
        order: [["uploaded_at", "DESC"], ["id", "DESC"]],
        include: [
            { model: Video, attributes: ["title"], required: false },
            { model: Sale, attributes: ["before_price", "sale_flag", "discount_rate", "discount_amount"], required: false },
        ],
        transaction,
    }) as Promise<(InstanceType<typeof Item> & UploadedItemListRow)[]>;
};

export const countMyUploadedItemList = ({ userId, where, transaction }: CountUploadedItemListParams): Promise<number> => {
    return Item.count({ where: { [Op.and]: [{ seller_id: userId }, where] }, transaction });
};
