import { col, Op, where } from "sequelize";
import { PointLots } from "../../models/index.js";
import type {
    CreatePointLotsParams,
    GetExpiredAllParams,
    UpdatePointLotsParams,
} from "../../types/serviceType/pointLots.js";

export const getExpiredAll = ({ expiredBefore }: GetExpiredAllParams) => {
    return PointLots.findAll({
        where: {
            [Op.and]: [{ expires_at: { [Op.lt]: expiredBefore } }, where(col("used_points"), Op.lt, col("points"))],
        },
    });
};

export const createPointLots = async ({ data, transaction }: CreatePointLotsParams) => {
    await PointLots.create(data, { transaction });
};

export const updatePointLots = async ({ lot, data, transaction }: UpdatePointLotsParams) => {
    await lot.update(data, { transaction });
};
