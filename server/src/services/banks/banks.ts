import { literal, Op } from "sequelize";
import { Banks } from "../../models/index.js";
import sequelize from "../../db.js";

type BankNameParams = {
    bankName: string;
};

export const getBankOne = ({ bankName }: BankNameParams) => {
    return Banks.findOne({
        where: {
            [Op.or]: [
                { name: bankName },
                sequelize.where(literal(`LOWER(normalize->>'name')`), bankName.toLowerCase()),
                sequelize.where(literal(`LOWER(normalize->>'kana')`), bankName.toLowerCase()),
                sequelize.where(literal(`LOWER(normalize->>'hira')`), bankName.toLowerCase()),
            ],
        },
    });
};

export const getBanksAll = () => {
    return Banks.findAll();
};
