import { InferAttributes, Op, WhereOptions } from "sequelize";
import Transfer from "../../models/transfer.js";
import { getTransferHistory } from "../../services/transfer/transfer.js";

type Params = {
    userId: number;
    limit: number;
    cursor?: string;
};

export const getTransferHistoryUseCase = async ({ userId, limit, cursor }: Params) => {
    const where: WhereOptions<InferAttributes<Transfer>> = cursor
        ? {
              user_id: userId,
              createdAt: {
                  [Op.lt]: new Date(cursor),
              },
          }
        : {
              user_id: userId,
          };

    // 振込申請データ取得
    const data = await getTransferHistory({ where, limit: limit + 1 });

    const hasMore = data.length > limit;

    const slicedData = hasMore ? data.slice(0, limit) : data;

    const lastItem = slicedData[slicedData.length - 1];

    const nextCursor = lastItem?.createdAt ?? null;

    return { history: slicedData, hasMore, nextCursor };
};
