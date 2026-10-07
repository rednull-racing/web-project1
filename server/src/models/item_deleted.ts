import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import Delivery from "./delivery.js";
import User from "./user.js";

export class ItemDeleted extends Model {
    declare id: number;
    declare item_id: number;
    declare seller_id: number;
    declare item_name: string;
    declare explain: string | null;
    declare price: number;
    declare image_url: string[] | null;
    declare video_url: string | null;
    declare thumbnail_url: string | null;
    declare video_title: string | null;
    declare video_summary: string | null;
    declare delete_reason: string;
    declare deleted_by: number;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        ItemDeleted.belongsTo(User, {
            foreignKey: "seller_id",
            as: "Seller",
        });
        ItemDeleted.belongsTo(User, {
            foreignKey: "deleted_by",
            as: "DeletedBy",
        });
    }

    static associations: {
        Seller: Association<ItemDeleted, User>;
        DeletedBy: Association<ItemDeleted, User>;
        Delivery: Association<ItemDeleted, Delivery>;
    };
}

ItemDeleted.init(
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
            unique: true,
        },
        seller_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        item_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        explain: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        price: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        image_url: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: true,
            validate: {
                maxArrayLength(value: string[]) {
                    if (value && value.length > 10) {
                        throw new Error("画像は最大10枚までです。");
                    }
                },
            },
        },
        video_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        thumbnail_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        video_title: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        video_summary: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        delete_reason: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        deleted_by: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
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
        modelName: "ItemDeleted",
        tableName: "item_deleted",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ItemDeleted;
