import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import ShopInfo from "./shop_info.js";
import ShopInfoEdit from "./shop_info_edit.js";
import ShopSignup from "./shop_signup.js";
import User from "./user.js";

export class BankAccount extends Model {
    declare id: number;
    declare bank_name: string | null;
    declare branch: string | null;
    declare account_number: string | null;
    declare meigi: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare bank_code: string | null;
    declare branch_code: string | null;
    declare account_type: "ordinary" | "checking" | "savings";

    static associate() {
        BankAccount.hasOne(ShopInfo, {
            foreignKey: "account_id",
        });
        BankAccount.hasOne(User, {
            foreignKey: "account_id",
        });
        BankAccount.hasOne(ShopSignup, {
            foreignKey: "account_id",
        });
        BankAccount.hasOne(ShopInfoEdit, {
            foreignKey: "account_id",
        });
    }

    static associations: {
        ShopInfo: Association<BankAccount, ShopInfo>;
        ShopSignup: Association<BankAccount, ShopSignup>;
        ShopInfoEdit: Association<BankAccount, ShopInfoEdit>;
        User: Association<BankAccount, User>;
    };
}

BankAccount.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        bank_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        branch: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        account_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        meigi: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        bank_code: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        branch_code: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        account_type: {
            type: DataTypes.ENUM("ordinary", "checking", "savings"),
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
        modelName: "BankAccount",
        tableName: "bank_account",
        freezeTableName: true,
        timestamps: true,
    },
);

export default BankAccount;
