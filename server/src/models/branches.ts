import { DataTypes, Model } from "sequelize";
import sequelize from "../db.js";
import type { BankNormalization } from "../types/bankNormalization.js";
import Banks from "./banks.js";

export class Branches extends Model {
    declare id: number;
    declare bank_code: string;
    declare code: string;
    declare name: string;
    declare kana: string | null;
    declare hira: string | null;
    declare normalize: BankNormalization | null;

    static associate() {
        Branches.belongsTo(Banks, {
            foreignKey: "bank_code",
            targetKey: "code",
        });
    }
}

Branches.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        bank_code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            references: {
                model: "banks",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
        code: {
            type: DataTypes.STRING(20),
            allowNull: false,
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
        modelName: "Branches",
        tableName: "branches",
        freezeTableName: true,
        timestamps: false,
    },
);

export default Branches;
