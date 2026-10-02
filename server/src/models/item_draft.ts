import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";
import type { ItemAttributes } from "../types/itemAttributes.js";

import BrandAliases from "./brand_aliases.js";
import Brands from "./brands.js";
import Categories from "./categories.js";
import ItemConditionOption from "./item_condition_option.js";
import User from "./user.js";

export class ItemDraft extends Model {
    declare id: number;
    declare name: string | null;
    declare detail: string | null;
    declare image_url: string[] | null;
    declare price: number | null;
    declare item_condition_id: number | null;
    declare seller_id: number | null;
    declare first_image_url: string | null;
    declare gender_type: "men" | "women" | "unisex";
    declare age_type: "adult" | "kids" | "both";
    declare category_id: number | null;
    declare brand_id: number | null;
    declare brand_aliases_id: number | null;
    declare attributes: ItemAttributes;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        ItemDraft.belongsTo(User, {
            foreignKey: "seller_id",
        });
        ItemDraft.belongsTo(ItemConditionOption, {
            foreignKey: "item_condition_id",
        });
        ItemDraft.belongsTo(Categories, {
            foreignKey: "category_id",
            as: "Category",
        });
        ItemDraft.belongsTo(Brands, {
            foreignKey: "brand_id",
            as: "Brand",
        });
        ItemDraft.belongsTo(BrandAliases, {
            foreignKey: "brand_aliases_id",
        });
    }

    static associations: {
        User: Association<ItemDraft, User>;
        ItemConditionOption: Association<ItemDraft, ItemConditionOption>;
        Categories: Association<ItemDraft, Categories>;
        Brand: Association<ItemDraft, Brands>;
        BrandAliases: Association<ItemDraft, BrandAliases>;
    };
}

ItemDraft.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        detail: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        price: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        item_condition_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "item_condition_option",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        seller_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        first_image_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        gender_type: {
            type: DataTypes.ENUM("men", "women", "unisex"),
            allowNull: false,
            defaultValue: "unisex",
        },
        age_type: {
            type: DataTypes.ENUM("adult", "kids", "both"),
            allowNull: false,
            defaultValue: "both",
        },
        category_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "categories",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        brand_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "brands",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "SET NULL",
        },
        brand_aliases_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "brand_aliases",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "SET NULL",
        },
        attributes: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
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
        modelName: "ItemDraft",
        tableName: "item_draft",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ItemDraft;
