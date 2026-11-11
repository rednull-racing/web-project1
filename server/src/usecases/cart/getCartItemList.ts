import { Op, Transaction } from "sequelize";
import sequelize from "../../db.js";
import {
    setCartItemListReadOnly,
    getMyCartItemList,
    countMyCartItemList,
} from "../../services/cart/query.js";
import type { ItemWhere } from "../../types/serviceType/items.js";
import type { CartItemListRow } from "../../types/serviceType/cart.js";
import type { GetCartItemListQuery } from "../../validators/query/cart.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";

type Params = GetCartItemListQuery & { userId: number };
type Result = { itemList: { item: CartItemListRow }[]; totalPages: number };

// GET /cart/item-list?page=number&status=""&keyword=""
// summary: カート商品リスト取得
// page: /item-list/cart
export const getCartItemListUseCase = async ({ userId, page, status, keyword }: Params): Promise<Result> => {
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
            await setCartItemListReadOnly({ transaction });
            const rows = await getMyCartItemList({ userId, where, limit, offset, transaction });
            const totalCount = await countMyCartItemList({ userId, where, transaction });
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
