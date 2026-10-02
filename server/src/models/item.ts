import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";
import type { ItemAttributes } from "../types/itemAttributes.js";

import BrandAliases from "./brand_aliases.js";
import Brands from "./brands.js";
import Cart from "./cart.js";
import Categories from "./categories.js";
import Comment from "./comment.js";
import CouponItem from "./coupon_item.js";
import ItemConditionOption from "./item_condition_option.js";
import ItemLike from "./item_like.js";
import ItemReport from "./item_report.js";
import ItemShippingProfile from "./item_shipping_profile.js";
import PurchaseSession from "./purchase_session.js";
import Sale from "./sale.js";
import User from "./user.js";
import Video from "./video.js";
import WatchHistory from "./watch_history.js";

export class Item extends Model {
    declare id: number;
    declare name: string | null;
    declare detail: string | null;
    declare image_url: string[] | null;
    declare price: number | null;
    declare sort_number: number | null;
    declare views_count: number | null;
    declare checked: boolean | null;
    declare early_sell: boolean | null;
    declare item_condition_id: number | null;
    declare seller_id: number | null;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare uploaded_at: Date | null;
    declare search_text: string | null;
    declare sort_buzz_number: number | null;
    declare deleted_at: Date | null;
    declare first_image_url: string | null;
    declare save_at: Date | null;
    declare gender_type: "men" | "women" | "unisex";
    declare age_type: "adult" | "kids" | "both";
    declare status: "editing" | "draft" | "active" | "hidden" | "soldout" | "deleted";
    declare category_id: number | null;
    declare brand_id: number | null;
    declare brand_aliases_id: number | null;
    declare attributes: ItemAttributes;
    declare recommend: boolean | null;
    declare report_score: number;
    declare video_id: number | null;
    declare sale_id: number | null;
    declare shipping_id: number | null;

    static associate() {
        Item.belongsTo(User, {
            foreignKey: "seller_id",
        });
        Item.belongsTo(ItemConditionOption, {
            foreignKey: "item_condition_id",
        });
        Item.belongsTo(Categories, {
            foreignKey: "category_id",
            as: "Category",
        });
        Item.belongsTo(Brands, {
            foreignKey: "brand_id",
            as: "Brand",
        });
        Item.belongsTo(BrandAliases, {
            foreignKey: "brand_aliases_id",
        });
        Item.belongsTo(Video, {
            foreignKey: "video_id",
        });
        Item.belongsTo(Sale, {
            foreignKey: "sale_id",
        });
        Item.belongsTo(ItemShippingProfile, {
            foreignKey: "shipping_id",
        });
        Item.hasMany(Cart, {
            foreignKey: "item_id",
        });
        Item.hasMany(ItemLike, {
            foreignKey: "item_id",
        });
        Item.hasMany(ItemReport, {
            foreignKey: "item_id",
        });
        Item.hasMany(PurchaseSession, {
            foreignKey: "item_id",
        });
        Item.hasMany(Comment, {
            foreignKey: "item_id",
        });
        Item.hasMany(WatchHistory, {
            foreignKey: "item_id",
        });
        Item.hasMany(CouponItem, {
            foreignKey: "item_id",
        });
    }

    static associations: {
        User: Association<Item, User>;
        ItemConditionOption: Association<Item, ItemConditionOption>;
        Cart: Association<Item, Cart>;
        ItemLike: Association<Item, ItemLike>;
        Video: Association<Item, Video>;
        Sale: Association<Item, Sale>;
        Categories: Association<Item, Categories>;
        ItemReport: Association<Item, ItemReport>;
        Brand: Association<Item, Brands>;
        BrandAliases: Association<Item, BrandAliases>;
        ItemShippingProfile: Association<Item, ItemShippingProfile>;
        Comment: Association<Item, Comment>;
        WatchHistory: Association<Item, WatchHistory>;
        PurchaseSession: Association<Item, PurchaseSession>;
        CouponItem: Association<Item, CouponItem>;
    };
}

Item.init(
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
        sort_number: {
            type: DataTypes.DECIMAL,
            allowNull: true,
            get() {
                // getterで明示的にNumberに変換
                return Number(this.getDataValue("sort_number"));
            },
        },
        views_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        checked: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        early_sell: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
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
        uploaded_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        search_text: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sort_buzz_number: {
            type: DataTypes.DECIMAL,
            allowNull: true,
            get() {
                // getterで明示的にNumberに変換
                return Number(this.getDataValue("sort_buzz_number"));
            },
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        first_image_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        save_at: {
            type: DataTypes.DATE,
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
        status: {
            type: DataTypes.ENUM("editing", "draft", "active", "hidden", "soldout", "deleted"),
            allowNull: false,
            defaultValue: "editing",
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
        recommend: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        report_score: {
            type: DataTypes.DECIMAL,
            defaultValue: 0,
            allowNull: false,
        },
        video_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "video",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "SET NULL",
        },
        sale_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "sale",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "SET NULL",
        },
        shipping_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "item_shipping_profile",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "SET NULL",
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
        modelName: "Item",
        tableName: "item",
        freezeTableName: true,
        timestamps: true,
    },
);

export default Item;
