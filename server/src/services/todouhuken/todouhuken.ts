import type { Transaction } from "sequelize";
import { TodouhukenOption } from "../../models/index.js";

type TodouhukenIdParams = {
    todouhukenId: number;
    transaction?: Transaction;
};

type TodouhukenParams = {
    todouhuken: string;
};

export const getTodouhuken = ({ todouhukenId, transaction }: TodouhukenIdParams) => {
    return transaction
        ? TodouhukenOption.findByPk(todouhukenId, { transaction })
        : TodouhukenOption.findByPk(todouhukenId);
};

export const getTodouhukenOne = ({ todouhuken }: TodouhukenParams) => {
    return TodouhukenOption.findOne({
        where: { name: todouhuken },
    });
};

export const getAllTodouhuken = () => {
    return TodouhukenOption.findAll();
};
