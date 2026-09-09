import { Association, DataTypes, Model } from "sequelize";

import sequelize from "../db.js";
import Address from "./address.js";
import BankAccount from "./bank_account.js";
import ComOrFreeOption from "./com_or_free_option.js";
import IdCard from "./id_card.js";
import Name from "./name.js";
import User from "./user.js";

export class ShopSignup extends Model {
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
    declare founded_date: Date | null;
    declare request_expired_at: Date;
    declare request_all: boolean;
    declare auto_trans: boolean;
    declare open_info: boolean;
    declare user_id: number | null;
    declare com_or_free_id: number | null;
    declare name_representative_id: number | null;
    declare name_contact_id: number | null;
    declare address_id: number | null;
    declare account_id: number | null;
    declare idcard_id: number | null;
    declare permit_id: number | null;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        ShopSignup.belongsTo(User, {
            foreignKey: "user_id",
        });
        ShopSignup.belongsTo(ComOrFreeOption, {
            foreignKey: "com_or_free_id",
        });
        ShopSignup.belongsTo(Name, {
            foreignKey: "name_representative_id",
            as: "RepresentativeName",
        });
        ShopSignup.belongsTo(Name, {
            foreignKey: "name_contact_id",
            as: "ContactName",
        });
        ShopSignup.belongsTo(Address, {
            foreignKey: "address_id",
        });
        ShopSignup.belongsTo(BankAccount, {
            foreignKey: "account_id",
        });
        ShopSignup.belongsTo(IdCard, {
            foreignKey: "idcard_id",
        });

        // 削除
        ShopSignup.belongsTo(Permit, {
            foreignKey: "permit_id",
        });
    }

    static associations: {
        User: Association<ShopSignup, User>;
        ComOrFreeOption: Association<ShopSignup, ComOrFreeOption>;
        Address: Association<ShopSignup, Address>;
        RepresentativeName: Association<ShopSignup, Name>;
        ContactName: Association<ShopSignup, Name>;
        BankAccount: Association<ShopSignup, BankAccount>;
        IdCard: Association<ShopSignup, IdCard>;

        // 削除
        Permit: Association<ShopSignup, Permit>;
    };
}

ShopSignup.init(
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
        founded_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        request_expired_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        request_all: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        auto_trans: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        open_info: {
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
        modelName: "ShopSignup",
        tableName: "shop_signup",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ShopSignup;
