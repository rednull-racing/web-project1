import { Op } from "sequelize";
import { SuggestWords } from "../../models/index.js";
import sequelize from "../../db.js";

type KeywordParams = {
    keyword: string;
};

export const getSuggestAll = ({ keyword }: KeywordParams) => {
    return SuggestWords.findAll({
        attributes: ["word"],
        where: {
            normalized_word: {
                [Op.iLike]: `%${keyword}%`,
            },
        },
        order: [
            [
                sequelize.literal(`
                        CASE
                        WHEN normalized_word ILIKE '${keyword}%' THEN 1
                        WHEN normalized_word ILIKE '% ${keyword}%' THEN 2
                        ELSE 3
                        END
                    `),
                "ASC",
            ],
            [sequelize.fn("length", sequelize.col("word")), "ASC"],
        ],
        limit: 10,
    });
};
