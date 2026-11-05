import { Model, DataTypes, Association } from "sequelize";
import sequelize from "../db.js";

import ItemDeleted from "./item_deleted.js";
import User from "./user.js";

export class ItemDeleteLogs extends Model {
    declare id: number;
    declare item_deleted_id: number | null;
    declare item_id: number;
    declare delete_user_id: number | null;
    declare delete_by_admin: boolean;
    declare delete_reason: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        ItemDeleteLogs.belongsTo(ItemDeleted, {
            foreignKey: "item_deleted_id",
        });
        ItemDeleteLogs.belongsTo(User, {
            foreignKey: "delete_user_id",
        });
    }

    static associations: {
        ItemDeleted: Association<ItemDeleteLogs, ItemDeleted>;
        User: Association<ItemDeleteLogs, User>;
    };
}

ItemDeleteLogs.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        item_deleted_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "item_deleted",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        item_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        delete_user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        delete_by_admin: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
        },
        delete_reason: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        modelName: "ItemDeleteLogs",
        tableName: "item_delete_logs",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ItemDeleteLogs;
