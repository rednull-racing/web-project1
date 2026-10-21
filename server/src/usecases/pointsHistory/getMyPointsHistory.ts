import { Op, WhereOptions } from "sequelize";
import { getMyPointsHistory } from "../../services/pointsHistory/pointsHistory.js";

type Params = {
    userId: number;
    limit: number;
    cursor?: string;
};

// GET /points-history?limit=number(&cursor="")
// summary: ポイント履歴取得
// page: /history/points
export const getMyPointsHistoryUseCase = async ({ userId, limit, cursor }: Params) => {
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

    // PointsHistory取得
    const data = await getMyPointsHistory({ where, limit });

    const hasMore = data.length > limit;

    const slicedData = hasMore ? data.slice(0, limit) : data;

    const lastItem = slicedData[slicedData.length - 1];

    const nextCursor = lastItem?.createdAt ?? null;

    return { history: slicedData, hasMore, nextCursor };
};
