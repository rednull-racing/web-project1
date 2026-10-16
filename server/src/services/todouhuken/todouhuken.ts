import { TodouhukenOption } from "../../models/index.js";

type TodouhukenIdParams = {
    todouhukenId: number;
};

type TodouhukenParams = {
    todouhuken: string;
};

export const getTodouhuken = ({ todouhukenId }: TodouhukenIdParams) => {
    return TodouhukenOption.findByPk(todouhukenId);
};

export const getTodouhukenOne = ({ todouhuken }: TodouhukenParams) => {
    return TodouhukenOption.findOne({
        where: { name: todouhuken },
    });
};

export const getAllTodouhuken = () => {
    return TodouhukenOption.findAll();
};
