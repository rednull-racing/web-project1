import type { Transaction } from "sequelize";
import { ItemConditionOption } from "../../models/index.js";

type ConditionIdParams = {
    conditionId: number;
    transaction?: Transaction;
};

export const findAllCondition = async () => {
    return ItemConditionOption.findAll();
};

export const getItemCondition = async ({ conditionId, transaction }: ConditionIdParams) => {
    return transaction
        ? ItemConditionOption.findByPk(conditionId, { transaction })
        : ItemConditionOption.findByPk(conditionId);
};
