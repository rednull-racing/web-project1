import { Op, Transaction } from "sequelize";
import sequelize from "../../db.js";
import { countMyItemLikeList, getMyItemLikeList, setItemLikeListReadOnly } from "../../services/itemLike/query.js";
import type { ItemLikeListRow } from "../../types/serviceType/itemLike.js";
import type { ItemWhere } from "../../types/serviceType/items.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";
import type { GetItemLikeListQuery } from "../../validators/query/itemLike.js";

type Params = GetItemLikeListQuery & { userId: number };
type Result = { itemList: { item: ItemLikeListRow }[]; totalPages: number };

// GET /item-like/item-list?page=number&status=""&keyword=""
// summary: いいねした商品リスト取得
// page: /item-list/like
export const getItemLikeListUseCase = async ({ userId, page, status, keyword }: Params): Promise<Result> => {
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
            await setItemLikeListReadOnly({ transaction });
            const rows = await getMyItemLikeList({ userId, where, limit, offset, transaction });
            const totalCount = await countMyItemLikeList({ userId, where, transaction });
            return {
                itemList: rows.map(({ Item: row }) => ({
                    item: {
                        id: row.id,
                        name: row.name,
                        price: row.price,
                        status: row.status,
                        first_image_url: row.first_image_url,
                        gender_type: row.gender_type,
                        age_type: row.age_type,
                        Video: row.Video ? { title: row.Video.title } : null,
                        Sale: row.Sale
                            ? {
                                  before_price: row.Sale.before_price,
                                  sale_flag: row.Sale.sale_flag,
                                  discount_rate: row.Sale.discount_rate,
                                  discount_amount: row.Sale.discount_amount,
                              }
                            : null,
                    },
                })),
                totalPages: Math.ceil(totalCount / limit),
            };
        },
    );
};
