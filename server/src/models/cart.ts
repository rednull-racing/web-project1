import { Model, DataTypes, Association } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import Item from "./item.js";
import User from "./user.js";

export class Cart extends Model {
    declare id: number;
    declare item_id: number;
    declare user_id: number;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare Item?: NonAttribute<Item | null>;

    static associate() {
        Cart.belongsTo(Item, {
            foreignKey: "item_id",
        });
        Cart.belongsTo(User, {
            foreignKey: "user_id",
        });
    }

    static associations: {
        Item: Association<Cart, Item>;
        User: Association<Cart, User>;
    };
}

Cart.init(
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
        modelName: "Cart",
        tableName: "cart",
        freezeTableName: true,
        timestamps: true,
    },
);

export default Cart;
