import { Transaction, WhereOptions } from "sequelize";
import { PointReasonOption, PointsHistory } from "../../models/index.js";

type MyPointsHistoryParams = {
    where: WhereOptions;
    limit: number;
};

type CreatePointsHistoryParams = {
    data: {
        points: number;
        reason_id: number;
        user_id: number;
    };
    transaction?: Transaction;
};

export const getMyPointsHistory = ({ where, limit }: MyPointsHistoryParams) => {
    return PointsHistory.findAll({
        attributes: ["id", "points", "createdAt"],
        where,
        order: [["createdAt", "DESC"]],
        limit,
        include: [{ model: PointReasonOption }],
    });
};

export const createPointsHistory = async ({ data, transaction }: CreatePointsHistoryParams) => {
    await PointsHistory.create(data, { transaction });
};
