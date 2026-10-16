import { CategoryIdParams, Level2Params } from "../../types/serviceType/categories.js";
import { Categories } from "../../models/index.js";

export const getCategories = ({ categoryId }: CategoryIdParams) => {
    return Categories.findByPk(categoryId);
};

export const getLevel2 = ({ parentId }: Level2Params) => {
    return Categories.findAll({
        where: {
            parent_id: parentId,
            level: 2,
        },
        order: [["sort_order", "ASC"]],
    });
};

export const getAllLevel1 = () => {
    return Categories.findAll({
        where: { level: 1 },
        order: [["sort_order", "ASC"]],
    });
};
