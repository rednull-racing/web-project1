import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import S3Metadata from "./s3_metadata.js";
import ShopInfo from "./shop_info.js";
import ShopInfoEdit from "./shop_info_edit.js";
import ShopSignup from "./shop_signup.js";

export class Permit extends Model {
    declare id: number;

    declare s3_metadata_id: number | null;

    declare sort_order: number | null;
    declare document_name: string | null;
    declare memo: string | null;
    declare permit_number: string | null;
    declare permit_type: string | null;
    declare issued_at: Date | null; // 登録日・許可証発行日
    declare expired_at: Date | null;

    declare shop_info_id: number | null;
    declare shop_info_edit_id: number | null;
    declare shop_signup_id: number | null;

    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        Permit.belongsTo(S3Metadata, {
            foreignKey: "s3_metadata_id",
        });
        Permit.belongsTo(ShopInfo, {
            foreignKey: "shop_info_id",
        });
        Permit.belongsTo(ShopSignup, {
            foreignKey: "shop_signup_id",
        });
        Permit.belongsTo(ShopInfoEdit, {
            foreignKey: "shop_info_edit_id",
        });
    }

    static associations: {
        S3Metadata: Association<Permit, S3Metadata>;
        ShopInfo: Association<Permit, ShopInfo>;
        ShopSignup: Association<Permit, ShopSignup>;
        ShopInfoEdit: Association<Permit, ShopInfoEdit>;
    };
}

Permit.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        s3_metadata_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            unique: true,
            references: {
                model: "s3_metadata",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        document_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        memo: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        permit_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        permit_type: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        issued_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        expired_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        shop_info_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shop_info",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
        shop_info_edit_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shop_info_edit",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
        shop_signup_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "shop_signup",
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
        modelName: "Permit",
        tableName: "permit",
        freezeTableName: true,
        timestamps: true,
    },
);

export default Permit;
