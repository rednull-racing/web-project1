import { Op } from "sequelize";
import { Item } from "../../../models/index.js";
import type {
    GetItemsReportScoreCronParams,
    GetItemsSortDecayCronParams,
} from "../../../types/serviceType/items.js";

export const getItemsReportScoreCron = ({ minReportScore }: GetItemsReportScoreCronParams) => {
    return Item.findAll({
        where: {
            report_score: { [Op.gt]: minReportScore },
        },
    });
};

export const getItemsSortBuzzNumberDecayCron = ({ minSortNumber }: GetItemsSortDecayCronParams) => {
    return Item.findAll({
        where: {
            status: { [Op.in]: ["active"] },
            sort_buzz_number: { [Op.gt]: minSortNumber },
        },
    });
};

export const getItemsSortNumberDecayCron = ({ minSortNumber }: GetItemsSortDecayCronParams) => {
    return Item.findAll({
        where: {
            status: { [Op.in]: ["active"] },
            sort_number: { [Op.gt]: minSortNumber },
        },
    });
};
