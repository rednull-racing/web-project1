import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";
import type { ItemAttributes } from "../types/itemAttributes.js";

import BrandAliases from "./brand_aliases.js";
import Brands from "./brands.js";
import Categories from "./categories.js";
import Item from "./item.js";
import ItemConditionOption from "./item_condition_option.js";
import ShippingDayOption from "./shipping_day_option.js";
import ShippingServiceOption from "./shipping_service_option.js";
import TodouhukenOption from "./todouhuken_option.js";
import User from "./user.js";

export class ItemDraft extends Model {
    declare id: number;
    declare item_id: number | null;
    declare name: string | null;
    declare detail: string | null;
    declare image_url: string[] | null;
    declare price: number | null;
    declare item_condition_id: number | null;
    declare seller_id: number | null;
    declare first_image_url: string | null;
    declare gender_type: "men" | "women" | "unisex";
    declare age_type: "adult" | "kids" | "both";
    declare recommend: boolean | null;
    declare category_id: number | null;
    declare brand_id: number | null;
    declare brand_aliases_id: number | null;
    declare attributes: ItemAttributes;

    declare thumbnail_url: string | null;
    declare title: string | null;
    declare summary: string | null;
    declare duration: number | null;
    declare original_url: string | null;
    declare converted_url: string | null;
    declare video_status: string | null;

    declare before_price: number | null;
    declare discount_rate: number | null;
    declare discount_amount: number | null;
    declare sale_flag: boolean;

    declare shipping_day_id: number | null;
    declare shipping_service_id: number | null;
    declare shipping_place_id: number | null;
    declare shipping_service_free_text: string | null;

    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        ItemDraft.belongsTo(Item, {
            foreignKey: "item_id",
        });
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
        ItemDraft.belongsTo(ShippingDayOption, {
            foreignKey: "shipping_day_id",
        });
        ItemDraft.belongsTo(ShippingServiceOption, {
            foreignKey: "shipping_service_id",
        });
        ItemDraft.belongsTo(TodouhukenOption, {
            foreignKey: "shipping_place_id",
        });
    }

    static associations: {
        Item: Association<ItemDraft, Item>;
        User: Association<ItemDraft, User>;
        ItemConditionOption: Association<ItemDraft, ItemConditionOption>;
        Categories: Association<ItemDraft, Categories>;
        Brand: Association<ItemDraft, Brands>;
        BrandAliases: Association<ItemDraft, BrandAliases>;
        ShippingDayOption: Association<ItemDraft, ShippingDayOption>;
        ShippingServiceOption: Association<ItemDraft, ShippingServiceOption>;
        TodouhukenOption: Association<ItemDraft, TodouhukenOption>;
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
        item_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "item",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "CASCADE",
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
        recommend: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
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
        thumbnail_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        title: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        summary: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        duration: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        original_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        converted_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        video_status: {
            type: DataTypes.STRING(255),
            allowNull: true,
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
        shipping_day_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shipping_day_option",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        shipping_service_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shipping_service_option",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        shipping_place_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "todouhuken_option",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        shipping_service_free_text: {
            type: DataTypes.STRING(255),
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
        modelName: "ItemDraft",
        tableName: "item_draft",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ItemDraft;
