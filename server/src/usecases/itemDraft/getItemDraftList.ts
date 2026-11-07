import { Op, Transaction } from "sequelize";
import type { InferAttributes, WhereOptions } from "sequelize";
import sequelize from "../../db.js";
import { getMyItemDraftList, countMyItemDraftList, setItemDraftListReadOnly } from "../../services/itemDraft/query.js";
import type { ItemDraftListRow } from "../../types/serviceType/itemDraft.js";
import type ItemDraft from "../../models/item_draft.js";
import type { GetItemDraftListQuery } from "../../validators/query/itemDraft.js";
import { normalizeJapanese } from "../../utils/normalizeJapanese.js";

type Params = GetItemDraftListQuery & { userId: number };
type Result = { itemDraftList: { itemDraft: ItemDraftListRow }[]; totalPages: number };

// GET /item-draft/list?page=number&keyword=""
// summary: 下書き商品リスト取得
// page: /item-list/draft
export const getItemDraftListUseCase = async ({ userId, page, keyword }: Params): Promise<Result> => {
    const limit = 20;
    const offset = (page - 1) * limit;
    const normalizedKeyword = keyword ? normalizeJapanese(keyword) : "";
    const pattern = `%${normalizedKeyword.replace(/[\\%_]/g, "\\$&")}%`;
    const where: WhereOptions<InferAttributes<ItemDraft>> = normalizedKeyword
        ? { [Op.or]: [{ name: { [Op.iLike]: pattern } }, { title: { [Op.iLike]: pattern } }] }
        : {};

    return await sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ, readOnly: true },
        async (transaction) => {
            await setItemDraftListReadOnly({ transaction });
            const rows = await getMyItemDraftList({ userId, where, limit, offset, transaction });
            const totalCount = await countMyItemDraftList({ userId, where, transaction });
            return {
                itemDraftList: rows.map((itemDraft) => ({ itemDraft })),
                totalPages: Math.ceil(totalCount / limit),
            };
        },
    );
};
