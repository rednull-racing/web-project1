import { col, Op, Order, where as sequelizeWhere } from "sequelize";
import { AppError } from "../../../errors.js";
import { countSellItem, countSoldItem } from "../../../services/items/index.js";
import { countUnread } from "../../../services/notification/notification.js";
import { countReferenceOutput } from "../../../services/referenceCode/referenceCode.js";
import { getMeMypage } from "../../../services/users/query.js";

type Params = {
    userId: number;
};

// GET /user/my-page
// summary: マイページ表示データ取得
// page: /my-page
export const getMyPageUseCase = async ({ userId }: Params) => {
    // PointLots
    // 期限切れに最も近いポイントを取得するwhere
    const pointLotsWhereCondition = {
        [Op.and]: [
            { expires_at: { [Op.lt]: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }, //30日後
            sequelizeWhere(col("used_points"), Op.lt, col("points")),
        ],
    };

    // UriagekinLots
    // 期限切れに最も近い売上金を取得するwhere
    const uriagekinLotsWhereCondition = {
        [Op.and]: [
            { expires_at: { [Op.lt]: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }, //30日後
            sequelizeWhere(col("used_uriagekin"), Op.lt, col("uriagekin")),
        ],
    };

    const order: Order = [["expires_at", "ASC"]];

    // ユーザー取得
    const user = await getMeMypage({
        userId,
        pointLotsWhere: pointLotsWhereCondition,
        uriagekinLotsWhere: uriagekinLotsWhereCondition,
        order,
    });

    if (!user) throw new AppError("USER_NOT_FOUND", 404);

    const hasShop = !!user.ShopInfo;

    const itemCount = await countSellItem({ userId });

    const soldItemCount = await countSoldItem({ userId });

    const unreadCount = await countUnread({ userId });

    const referenceCount = await countReferenceOutput({ userId });

    const plainUser = user.get({ plain: true });

    // 未使用ポイント計算
    if (user.PointLots && user.PointLots.length > 0) {
        const lots = user.PointLots[0];
        const alertPoints = lots.points - lots.used_points;

        plainUser.PointLots = {
            ...lots.get({ plain: true }),
            alertPoints,
        };
    }

    // 未使用売上金計算
    if (user.UriagekinLots && user.UriagekinLots.length > 0) {
        const lots = user.UriagekinLots[0];
        const alertUriagekin = lots.uriagekin - lots.used_uriagekin;

        plainUser.UriagekinLots = {
            ...lots.get({ plain: true }),
            alertUriagekin,
        };
    }

    return {
        user: plainUser,
        hasShop,
        itemCount,
        soldItemCount,
        unreadCount,
        referenceCount,
    };
};
