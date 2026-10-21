import { DataTypes, Model } from "sequelize";
import sequelize from "../db.js";
import type { BankNormalization } from "../types/bankNormalization.js";

export class Banks extends Model {
    declare id: number;
    declare code: string;
    declare name: string;
    declare kana: string | null;
    declare hira: string | null;
    declare normalize: BankNormalization | null;
}

Banks.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        kana: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        hira: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        normalize: {
            type: DataTypes.JSONB,
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "Banks",
        tableName: "banks",
        freezeTableName: true,
        timestamps: false,
    },
);

export default Banks;
