import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import Permit from "./permit.js";
import S3Metadata from "./s3_metadata.js";
import ShopInfo from "./shop_info.js";
import ShopInfoEdit from "./shop_info_edit.js";
import ShopSignup from "./shop_signup.js";

export class PermitFile extends Model {
    declare id: number;

    declare s3_metadata_id: number | null;
    declare sort_order: number | null;
    declare document_name: string | null;
    declare memo: string | null;

    // 追加カラム
    declare permit_number: string | null;
    declare permit_type: string | null;
    declare issued_at: Date | null; // 登録日・許可証発行日
    declare expired_at: Date | null;

    // 追加リレーションカラム
    declare shop_info_id: number | null;
    declare shop_info_edit_id: number | null;
    declare shop_signup_id: number | null;

    // permit_id削除
    declare permit_id: number;

    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        PermitFile.belongsTo(S3Metadata, {
            foreignKey: "s3_metadata_id",
        });

        // 追加
        PermitFile.belongsTo(ShopInfo, {
            foreignKey: "shop_info_id",
        });
        PermitFile.belongsTo(ShopSignup, {
            foreignKey: "shop_signup_id",
        });
        PermitFile.belongsTo(ShopInfoEdit, {
            foreignKey: "shop_info_edit_id",
        });

        // 削除
        PermitFile.belongsTo(Permit, {
            foreignKey: "permit_id",
        });
    }

    static associations: {
        S3Metadata: Association<PermitFile, S3Metadata>;

        // 追加
        ShopInfo: Association<PermitFile, ShopInfo>;
        ShopSignup: Association<PermitFile, ShopSignup>;
        ShopInfoEdit: Association<PermitFile, ShopInfoEdit>;

        // 削除
        Permit: Association<PermitFile, Permit>;
    };
}

PermitFile.init(
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

        // 追加
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

        // 削除
        permit_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "permit",
                key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
        },
    },
    {
        sequelize,
        modelName: "PermitFile",
        tableName: "permit_file",
        freezeTableName: true,
        timestamps: true,
    },
);

export default PermitFile;
