import { Association, DataTypes, Model } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import Address from "./address.js";
import DeliveryStatusOption from "./delivery_status_option.js";
import Name from "./name.js";
import Orders from "./orders.js";
import ShippingDayOption from "./shipping_day_option.js";
import ShippingServiceOption from "./shipping_service_option.js";
import TodouhukenOption from "./todouhuken_option.js";

export class Delivery extends Model {
    declare id: number;
    declare buyer_phone_number: string | null;
    declare cancel: boolean | null;
    declare shipping_day_id: number | null;
    declare shipping_service_id: number | null;
    declare delivery_status_id: number | null;
    declare shipping_place_id: number | null;
    declare orders_id: number | null;
    declare shipping_at: Date | null;
    declare arrived_at: Date | null;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare arrive_specified_date: Date | null;
    declare shipping_service_free_text: string | null; // 自由入力配送方法（その他の場合のみ）
    declare shipping_from_name: string | null; // 出品者氏名
    declare shipping_from_postcode: string | null; // 出品者郵便番号
    declare shipping_from_prefecture: string | null; // 出品者都道府県
    declare shipping_from_address_line1: string | null; // 出品者市区町村・丁目・番地
    declare shipping_from_address_line2: string | null; // 出品者住所（建物名・部屋番号・補足）
    declare shipping_from_phone: string | null; // 出品者電話番号
    declare tracking_number: string | null; // 追跡番号（手入力）
    declare shipping_memo: string | null; // 配送メモ（自由入力）
    declare address_id: number | null;
    declare name_id: number | null;

    declare Address?: NonAttribute<Address | null>;
    declare Name?: NonAttribute<Name | null>;

    static associate() {
        Delivery.belongsTo(ShippingDayOption, {
            foreignKey: "shipping_day_id",
        });
        Delivery.belongsTo(ShippingServiceOption, {
            foreignKey: "shipping_service_id",
        });
        Delivery.belongsTo(DeliveryStatusOption, {
            foreignKey: "delivery_status_id",
        });
        Delivery.belongsTo(TodouhukenOption, {
            foreignKey: "shipping_place_id",
        });
        Delivery.belongsTo(Orders, {
            foreignKey: "orders_id",
        });
        Delivery.belongsTo(Address, {
            foreignKey: "address_id",
        }); // buyer
        Delivery.belongsTo(Name, {
            foreignKey: "name_id",
        }); // buyer
    }

    static associations: {
        ShippingDayOption: Association<Delivery, ShippingDayOption>;
        ShippingServiceOption: Association<Delivery, ShippingServiceOption>;
        DeliveryStatusOption: Association<Delivery, DeliveryStatusOption>;
        TodouhukenOption: Association<Delivery, TodouhukenOption>;
        Orders: Association<Delivery, Orders>;
        Address: Association<Delivery, Address>;
        Name: Association<Delivery, Name>;
    };
}

Delivery.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        buyer_phone_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        cancel: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        shipping_day_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shipping_day_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        shipping_service_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shipping_service_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        delivery_status_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "delivery_status_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        shipping_place_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "todouhuken_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        orders_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "orders",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },
        shipping_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        arrived_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        arrive_specified_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        shipping_service_free_text: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_from_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_from_postcode: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_from_prefecture: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_from_address_line1: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_from_address_line2: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_from_phone: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        tracking_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shipping_memo: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        address_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "address",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },
        name_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "name",
                key: "id",
            },
            onUpdate: "CASCADE",
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
        modelName: "Delivery",
        tableName: "delivery",
        freezeTableName: true,
        timestamps: true,
    },
);

export default Delivery;
