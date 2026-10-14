import { Model, DataTypes, Association } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import User from "./user.js";
import Item from "./item.js";

export class WatchHistory extends Model {
    declare id: number;
    declare item_id: number;
    declare user_id: number;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare Item?: NonAttribute<Item | null>;

    static associate() {
        WatchHistory.belongsTo(Item, {
            foreignKey: "item_id",
        });
        WatchHistory.belongsTo(User, {
            foreignKey: "user_id",
        });
    }

    static associations: {
        Item: Association<WatchHistory, Item>;
        User: Association<WatchHistory, User>;
    };
}

WatchHistory.init(
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
            onDelete: "CASCADE",
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
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
        modelName: "WatchHistory",
        tableName: "watch_history",
        freezeTableName: true,
        timestamps: true,
    },
);

export default WatchHistory;
