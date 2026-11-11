import { Op, Transaction } from "sequelize";
import sequelize from "../../../db.js";
import {
    countMyStockItemList,
    getMyStockItemList,
    setStockItemListReadOnly,
} from "../../../services/items/query/list/userItemList.js";
import type { ItemWhere, StockItemListRow } from "../../../types/serviceType/items.js";
import { normalizeJapanese } from "../../../utils/normalizeJapanese.js";
import type { GetStockItemListQuery } from "../../../validators/query/items.js";

type Params = GetStockItemListQuery & { userId: number };
type Result = { itemList: { item: StockItemListRow }[]; totalPages: number };

// GET /items/list/stock?page=number&status=""&keyword=""
// summary: 在庫付き出品した商品リスト取得
// page: /item-list/stock
export const getStockItemListUseCase = async ({ userId, page, status, keyword }: Params): Promise<Result> => {
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
            await setStockItemListReadOnly({ transaction });
            const rows = await getMyStockItemList({ userId, where, limit, offset, transaction });
            const totalCount = await countMyStockItemList({ userId, where, transaction });
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
                        attributes: row.attributes,
                        uploaded_at: row.uploaded_at,
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
