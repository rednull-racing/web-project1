import { WhereOptions } from "sequelize";
import { UriagekinHistory, UriagekinReasonOption } from "../../models/index.js";

type MyUriagekinHistoryParams = {
    where: WhereOptions;
    limit: number;
};

export const getMyUriagekinHistory = ({ where, limit }: MyUriagekinHistoryParams) => {
    return UriagekinHistory.findAll({
        attributes: ["id", "uriagekin", "createdAt"],
        where,
        order: [["createdAt", "DESC"]],
        limit,
        include: [{ model: UriagekinReasonOption }],
    });
};
