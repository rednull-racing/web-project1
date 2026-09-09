import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import Address from "./address.js";
import BankAccount from "./bank_account.js";
import ComOrFreeOption from "./com_or_free_option.js";
import IdCard from "./id_card.js";
import Name from "./name.js";
import ShopInfo from "./shop_info.js";
import User from "./user.js";
import Permit from "./permit.js";

export class ShopInfoEdit extends Model {
    declare id: number;
    declare company_name: string | null;
    declare company_number: string | null;
    declare phone_number: string | null;
    declare email: string | null;
    declare founded_date: Date | null;
    declare member_count: number | null;
    declare homepage_url: string | null;
    declare capital: number | null;
    declare open_date_time: string | null;
    declare user_id: number | null;
    declare shop_info_id: number | null;
    declare com_or_free_id: number | null;
    declare createdAt: Date;
    declare updatedAt: Date;
    declare name_representative_id: number | null;
    declare name_contact_id: number | null;
    declare address_id: number | null;
    declare account_id: number | null;
    declare idcard_id: number | null;

    // 削除
    declare permit_id: number | null;

    static associate() {
        ShopInfoEdit.belongsTo(User, {
            foreignKey: "user_id",
        });
        ShopInfoEdit.belongsTo(ShopInfo, {
            foreignKey: "shop_info_id",
        });
        ShopInfoEdit.belongsTo(ComOrFreeOption, {
            foreignKey: "com_or_free_id",
        });
        ShopInfoEdit.belongsTo(Name, {
            foreignKey: "name_representative_id",
            as: "RepresentativeNameEdit",
        });
        ShopInfoEdit.belongsTo(Name, {
            foreignKey: "name_contact_id",
            as: "ContactNameEdit",
        });
        ShopInfoEdit.belongsTo(Address, {
            foreignKey: "address_id",
        });
        ShopInfoEdit.belongsTo(BankAccount, {
            foreignKey: "account_id",
        });
        ShopInfoEdit.belongsTo(IdCard, {
            foreignKey: "idcard_id",
        });
        ShopInfoEdit.hasMany(Permit, {
            foreignKey: "shop_info_edit_id",
        });
    }

    static associations: {
        User: Association<ShopInfoEdit, User>;
        ShopInfo: Association<ShopInfoEdit, ShopInfo>;
        ComOrFreeOption: Association<ShopInfoEdit, ComOrFreeOption>;
        Address: Association<ShopInfoEdit, Address>;
        RepresentativeNameEdit: Association<ShopInfoEdit, Name>;
        ContactNameEdit: Association<ShopInfoEdit, Name>;
        BankAccount: Association<ShopInfoEdit, BankAccount>;
        IdCard: Association<ShopInfoEdit, IdCard>;
        Permit: Association<ShopInfoEdit, Permit>;
    };
}

ShopInfoEdit.init(
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
        company_number: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        phone_number: {
            type: DataTypes.STRING(20),
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        founded_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        member_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        homepage_url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        capital: {
            type: DataTypes.DECIMAL,
            allowNull: true,
        },
        open_date_time: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        shop_info_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shop_info",
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
            onDelete: "NO ACTION",
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
            onDelete: "NO ACTION",
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
        modelName: "ShopInfoEdit",
        tableName: "shop_info_edit",
        freezeTableName: true,
        timestamps: true,
    },
);

export default ShopInfoEdit;
