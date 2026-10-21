import { col, Op, where } from "sequelize";
import { UriagekinLots } from "../../models/index.js";
import type {
    GetExpiredUriageAllParams,
    UpdateUsedUriageParams,
    UriagekinLotsInstance,
} from "../../types/serviceType/uriagekinLots.js";

export const getExpiredUriageAll = ({ expiredBefore }: GetExpiredUriageAllParams): Promise<UriagekinLotsInstance[]> => {
    return UriagekinLots.findAll({
        where: {
            [Op.and]: [
                { expires_at: { [Op.lt]: expiredBefore } },
                where(col("used_uriagekin"), Op.lt, col("uriagekin")),
            ],
        },
    });
};

export const updateUsedUriagekin = async ({ lots, data, transaction }: UpdateUsedUriageParams) => {
    await lots.update(data, { transaction });
};
