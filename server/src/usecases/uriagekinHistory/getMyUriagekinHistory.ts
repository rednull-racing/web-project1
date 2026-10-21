import { Op, WhereOptions } from "sequelize";
import { getMyUriagekinHistory } from "../../services/uriagekinHistory/uriagekinHistory.js";

type Params = {
    userId: number;
    limit: number;
    cursor?: string;
};

// GET /uriagekin-history?limit=number(&cursor="")
// summary: 売上金履歴取得
// page: /history/uriagekin
export const getMyUriagekinHistoryUseCase = async ({ userId, limit, cursor }: Params) => {
    // 条件分岐
    const where: WhereOptions = cursor
        ? {
              user_id: userId,
              createdAt: {
                  [Op.lt]: new Date(cursor),
              },
          }
        : {
              user_id: userId,
          };

    // UriagekinHistory取得
    const data = await getMyUriagekinHistory({ where, limit });

    const hasMore = data.length > limit;

    const slicedData = hasMore ? data.slice(0, limit) : data;

    const lastItem = slicedData[slicedData.length - 1];

    const nextCursor = lastItem?.createdAt ?? null;

    return { history: slicedData, hasMore, nextCursor };
};
