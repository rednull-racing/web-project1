import { Op, Transaction } from "sequelize";
import sequelize from "../../../db.js";
import { setUploadedItemListReadOnly, getMyUploadedItemList, countMyUploadedItemList } from "../../../services/items/query/list/userItemList.js";
import type { ItemWhere, UploadedItemListRow } from "../../../types/serviceType/items.js";
import type { GetUploadedItemListQuery } from "../../../validators/query/items.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";

type Params = GetUploadedItemListQuery & { userId: number };
type Result = { itemList: { item: UploadedItemListRow }[]; totalPages: number };

// GET /items/list/uploaded?page=number&status=""&keyword=""
// summary: 出品した商品リスト取得
// page: /item-list/uploaded
export const getUploadedItemListUseCase = async ({ userId, page, status, keyword }: Params): Promise<Result> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const where: ItemWhere = { status: status ?? { [Op.in]: ["active", "soldout"] } };
    const normalizedKeyword = keyword ? normalizeJapanese(keyword) : "";
    if (normalizedKeyword) {
        where.search_text = { [Op.iLike]: `%${normalizedKeyword.replace(/[\\%_]/g, "\\$&")}%` };
    }

    return await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true },
        async (transaction) => {
            await setUploadedItemListReadOnly({ transaction });
            const rows = await getMyUploadedItemList({ userId, where, limit, offset, transaction });
            const totalCount = await countMyUploadedItemList({ userId, where, transaction });
            return {
                itemList: rows.map((row) => ({
                    item: {
                        id: row.id,
                        name: row.name,
                        price: row.price,
                        status: row.status,
                        first_image_url: row.first_image_url,
                        gender_type: row.gender_type,
                        age_type: row.age_type,
                        uploaded_at: row.uploaded_at,
                        Video: row.Video ? { title: row.Video.title } : null,
                        Sale: row.Sale ? {
                            before_price: row.Sale.before_price,
                            sale_flag: row.Sale.sale_flag,
                            discount_rate: row.Sale.discount_rate,
                            discount_amount: row.Sale.discount_amount,
                        } : null,
                    },
                })),
                totalPages: Math.ceil(totalCount / limit),
            };
        },
    );
};
