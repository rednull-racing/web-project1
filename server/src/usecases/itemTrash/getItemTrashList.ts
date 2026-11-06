import { Op, Transaction } from "sequelize";
import type { WhereOptions } from "sequelize";
import sequelize from "../../db.js";
import { getMyItemTrashList, countMyItemTrashList, setItemTrashListReadOnly } from "../../services/itemTrash/query.js";
import type { ItemTrashListRow } from "../../types/serviceType/itemTrash.js";
import type ItemTrash from "../../models/item_trash.js";
import type { GetItemTrashListQuery } from "../../validators/query/itemTrash.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";

type Params = GetItemTrashListQuery & { userId: number };
type Result = { itemTrashList: { itemTrash: ItemTrashListRow }[]; totalPages: number };

// GET /item-trash/list?page=number&keyword=""
// summary: 削除した商品リスト取得
// page: /item-list/trash
export const getItemTrashListUseCase = async ({ userId, page, keyword }: Params): Promise<Result> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const normalizedKeyword = keyword ? normalizeJapanese(keyword) : "";
    const pattern = `%${normalizedKeyword.replace(/[\\%_]/g, "\\$&")}%`;
    const where: WhereOptions<ItemTrash> = normalizedKeyword
        ? { [Op.or]: [{ name: { [Op.iLike]: pattern } }, { title: { [Op.iLike]: pattern } }] }
        : {};

    return await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true },
        async (transaction) => {
            await setItemTrashListReadOnly({ transaction });
            const rows = await getMyItemTrashList({ userId, where, limit, offset, transaction });
            const totalCount = await countMyItemTrashList({ userId, where, transaction });
            return {
                itemTrashList: rows.map((itemTrash) => ({ itemTrash })),
                totalPages: Math.ceil(totalCount / limit),
            };
        },
    );
};
