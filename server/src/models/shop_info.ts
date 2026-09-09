import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import Address from "./address.js";
import BankAccount from "./bank_account.js";
import ComOrFreeOption from "./com_or_free_option.js";
import CouponShop from "./coupon_shop.js";
import IdCard from "./id_card.js";
import Name from "./name.js";
import User from "./user.js";
import Permit from "./permit.js";

export class ShopInfo extends Model {
    declare id: number;
    declare company_name: string | null;
    declare shop_name: string | null;
    declare email: string | null;
    declare phone_number: string | null;
    declare homepage_url: string | null;
    declare open_date_time: string | null;
    declare company_number: string | null;
    declare capital: number | null;
    declare member_count: number | null;
    declare request_all: boolean;
    declare verified: boolean;
    declare auto_trans: boolean;
    declare user_id: number | null;
    declare com_or_free_id: number | null;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare founded_date: Date | null;
    declare open_info: boolean;
    declare name_representative_id: number | null;
    declare name_contact_id: number | null;
    declare address_id: number | null;
    declare account_id: number | null;
    declare idcard_id: number | null;

    // 削除
    declare permit_id: number | null;

    static associate() {
        ShopInfo.belongsTo(User, {
            foreignKey: "user_id",
        });
        ShopInfo.belongsTo(ComOrFreeOption, {
            foreignKey: "com_or_free_id",
        });
        ShopInfo.belongsTo(Name, {
            foreignKey: "name_representative_id",
            as: "RepresentativeName",
        });
        ShopInfo.belongsTo(Name, {
            foreignKey: "name_contact_id",
            as: "ContactName",
        });
        ShopInfo.belongsTo(Address, {
            foreignKey: "address_id",
        });
        ShopInfo.belongsTo(BankAccount, {
            foreignKey: "account_id",
        });
        ShopInfo.belongsTo(IdCard, {
            foreignKey: "idcard_id",
        });
        ShopInfo.hasMany(CouponShop, {
            foreignKey: "shop_info_id",
        });
        ShopInfo.hasMany(Permit, {
            foreignKey: "permit_id",
        });
    }

    static associations: {
        User: Association<ShopInfo, User>;
        ComOrFreeOption: Association<ShopInfo, ComOrFreeOption>;
        Address: Association<ShopInfo, Address>;
        RepresentativeName: Association<ShopInfo, Name>;
        ContactName: Association<ShopInfo, Name>;
        BankAccount: Association<ShopInfo, BankAccount>;
        Permit: Association<ShopInfo, Permit>;
        IdCard: Association<ShopInfo, IdCard>;
        CouponShop: Association<ShopInfo, CouponShop>;
    };
}

ShopInfo.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        company_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        shop_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        phone_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        homepage_url: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        open_date_time: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        company_number: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        capital: {
            type: DataTypes.DECIMAL,
            allowNull: true,
        },
        member_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        request_all: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        verified: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        auto_trans: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        com_or_free_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "com_or_free_option",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "NO ACTION",
        },
        founded_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        open_info: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        name_representative_id: {
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
        name_contact_id: {
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
        account_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "bank_account",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },
        idcard_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "id_card",
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

        // 削除
        permit_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "permit",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "SET NULL",
        },
    },
    {
        sequelize,
        modelName: "ShopInfo",
        tableName: "shop_info",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ShopInfo;
