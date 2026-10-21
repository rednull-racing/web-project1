import { Association, DataTypes, Model } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";
import type { PurchaseSnapshot } from "../types/purchaseSnapshot.js";

import Cancel from "./cancel.js";
import Chat from "./chat.js";
import CouponUser from "./coupon_user.js";
import Delivery from "./delivery.js";
import Item from "./item.js";
import PaymentMethodOption from "./payment_method_option.js";
import User from "./user.js";

export class Orders extends Model {
    declare id: number;
    declare unit_price: number | null; // 1点当たりの金額
    declare item_count: number | null; // 個数
    declare subtotal_amount: number | null; // unit_price × item_count
    declare discount_amount: number | null; // 割引（クーポン等）
    declare total_amount: number | null; // ポイントを含む合計支払金額
    declare points_used: number | null; // ポイント払い
    declare paid_amount: number | null; // ポイントを除く合計支払金額
    declare sales_commission_amount: number | null; // 販売手数料
    declare gain_amount: number | null; // 出品者売上金
    declare payment_method_id: number | null;
    declare item_id: number | null;
    declare seller_user_id: number | null;
    declare buyer_user_id: number | null;
    declare buy_at: Date | null;
    declare paid_at: Date | null;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare order_id: string | null; // 22文字、crypto.randomBytes(16).toString("base64url");
    declare status: "pending" | "paid" | "shipped" | "completed" | "cancelled" | "returned";
    declare purchase_snapshot: PurchaseSnapshot;
    declare coupon_user_id: number | null;

    declare Delivery?: NonAttribute<Delivery | null>;
    declare Item?: NonAttribute<Item | null>;

    static associate() {
        Orders.belongsTo(PaymentMethodOption, {
            foreignKey: "payment_method_id",
        });
        Orders.belongsTo(Item, {
            foreignKey: "item_id",
        });
        Orders.belongsTo(User, {
            foreignKey: "seller_user_id",
            as: "Seller",
        });
        Orders.belongsTo(User, {
            foreignKey: "buyer_user_id",
            as: "Buyer",
        });
        Orders.belongsTo(CouponUser, {
            foreignKey: "coupon_user_id",
        });
        Orders.hasOne(Delivery, {
            foreignKey: "orders_id",
        });
        Orders.hasOne(Chat, {
            foreignKey: "orders_id",
        });
        Orders.hasOne(Cancel, {
            foreignKey: "orders_id",
        });
    }

    static associations: {
        PaymentMethodOption: Association<Orders, PaymentMethodOption>;
        CouponUser: Association<Orders, CouponUser>;
        Item: Association<Orders, Item>;
        Delivery: Association<Orders, Delivery>;
        Seller: Association<Orders, User>;
        Buyer: Association<Orders, User>;
        Chat: Association<Orders, Chat>;
        Cancel: Association<Orders, Cancel>;
    };
}

Orders.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        unit_price: {
            // 1点当たり
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        item_count: {
            // 個数
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        subtotal_amount: {
            // 小計
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        discount_amount: {
            // クーポン等
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        total_amount: {
            // ポイント込み合計請求金額
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        points_used: {
            // ポイント利用
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        paid_amount: {
            // ポイント除外合計請求金額
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        sales_commission_amount: {
            // 販売手数料
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        gain_amount: {
            //出品者売上金
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
            onDelete: "NO ACTION",
        },
        item_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "item",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        seller_user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        buyer_user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        buy_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        paid_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        order_id: {
            type: DataTypes.STRING(50),
            allowNull: true,
            unique: true,
        },
        status: {
            type: DataTypes.ENUM("pending", "paid", "shipped", "completed", "cancelled", "returned"),
            allowNull: false,
            defaultValue: "pending",
        },
        purchase_snapshot: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
        },
        coupon_user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "coupon_user",
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
        modelName: "Orders",
        tableName: "orders",
        freezeTableName: true,
        timestamps: true,
    },
);

export default Orders;
