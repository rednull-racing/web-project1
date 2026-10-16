import { ItemConditionOption } from "../../models/index.js";

type ConditionIdParams = {
    conditionId: number;
};

export const findAllCondition = async () => {
    return ItemConditionOption.findAll();
};

export const getItemCondition = async ({ conditionId }: ConditionIdParams) => {
    return ItemConditionOption.findByPk(conditionId);
};
