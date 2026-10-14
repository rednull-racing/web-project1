import { Association, DataTypes, Model } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import Address from "./address.js";
import CouponUser from "./coupon_user.js";
import Item from "./item.js";
import Name from "./name.js";
import PaymentMethodOption from "./payment_method_option.js";
import User from "./user.js";

type SelectedVariant = {
    color?: string;
    size?: string;
    [key: string]: string | undefined;
};

export class PurchaseSession extends Model {
    declare id: number;
    declare buyer_user_id: number;
    declare item_id: number;
    declare address_id: number;
    declare name_id: number;
    declare coupon_user_id: number | null;
    declare buyer_phone_number: string | null;
    declare item_count: number | null; // 購入個数
    declare points_used: number | null; // ポイント払い額
    declare payment_method_id: number | null;
    declare selected_variant: SelectedVariant;
    declare arrive_specified_date: Date | null;
    declare expires_at: Date;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare Address?: NonAttribute<Address | null>;
    declare Name?: NonAttribute<Name | null>;

    static associate() {
        PurchaseSession.belongsTo(User, {
            foreignKey: "buyer_user_id",
        });
        PurchaseSession.belongsTo(Item, {
            foreignKey: "item_id",
        });
        PurchaseSession.belongsTo(Address, {
            foreignKey: "address_id",
        });
        PurchaseSession.belongsTo(Name, {
            foreignKey: "name_id",
        });
        PurchaseSession.belongsTo(CouponUser, {
            foreignKey: "coupon_user_id",
        });
        PurchaseSession.belongsTo(PaymentMethodOption, {
            foreignKey: "payment_method_id",
        });
    }

    static associations: {
        User: Association<PurchaseSession, User>;
        Item: Association<PurchaseSession, Item>;
        Address: Association<PurchaseSession, Address>;
        Name: Association<PurchaseSession, Name>;
        CouponUser: Association<PurchaseSession, CouponUser>;
        PaymentMethodOption: Association<PurchaseSession, PaymentMethodOption>;
    };
}

PurchaseSession.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        buyer_user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onDelete: "CASCADE",
            onUpdate: "CASCADE",
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
        address_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "address",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        },
        name_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "name",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "RESTRICT",
        },
        coupon_user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "coupon_user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },
        buyer_phone_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        item_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        points_used: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        payment_method_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "payment_method_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },
        selected_variant: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
        },
        arrive_specified_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
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
        modelName: "PurchaseSession",
        tableName: "purchase_session",
        freezeTableName: true,
        timestamps: true,
    },
);

export default PurchaseSession;
