import { Model, DataTypes, Association } from "sequelize";
import sequelize from "../db.js";

import Item from "./item.js";

export class Sale extends Model {
    declare id: number;
    declare before_price: number | null;
    declare discount_rate: number | null;
    declare discount_amount: number | null;
    declare sale_flag: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        Sale.hasOne(Item, {
            foreignKey: "sale_id",
        });
    }

    static associations: {
        Item: Association<Sale, Item>;
    };
}

Sale.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        before_price: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        discount_rate: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        discount_amount: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        sale_flag: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    },
    {
        sequelize,
        modelName: "Sale",
        tableName: "sale",
        freezeTableName: true,
        timestamps: true,
    },
);

export default Sale;
