import { Model, DataTypes, Association } from "sequelize";
import sequelize from "../db.js";

import Item from "./item.js";
import User from "./user.js";
import ItemBuyerReportOption from "./item_buyer_report_option.js";
import Orders from "./orders.js";

export class ItemBuyerReport extends Model {
    declare id: number;
    declare item_id: number;
    declare report_user_id: number;
    declare option_id: number;
    declare detail_text: string | null;
    declare orders_id: number;
    declare checked: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        ItemBuyerReport.belongsTo(Item, {
            foreignKey: "item_id",
        });
        ItemBuyerReport.belongsTo(User, {
            foreignKey: "report_user_id",
        });
        ItemBuyerReport.belongsTo(ItemBuyerReportOption, {
            foreignKey: "option_id",
        });
        ItemBuyerReport.belongsTo(Orders, {
            foreignKey: "orders_id",
        });
    }

    static associations: {
        Item: Association<ItemBuyerReport, Item>;
        User: Association<ItemBuyerReport, User>;
        ItemBuyerReportOption: Association<ItemBuyerReport, ItemBuyerReportOption>;
        Orders: Association<ItemBuyerReport, Orders>;
    };
}

ItemBuyerReport.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        item_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "item",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        report_user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        option_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "item_buyer_report_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        detail_text: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        orders_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: "orders",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        checked: {
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
        modelName: "ItemBuyerReport",
        tableName: "item_buyer_report",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ItemBuyerReport;
