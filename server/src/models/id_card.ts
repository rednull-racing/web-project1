import { Association, DataTypes, Model } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import S3Metadata from "./s3_metadata.js";
import ShopInfo from "./shop_info.js";
import ShopInfoEdit from "./shop_info_edit.js";
import ShopSignup from "./shop_signup.js";
import User from "./user.js";

export class IdCard extends Model {
    declare id: number;
    declare front_s3_metadata_id: number | null;
    declare rear_s3_metadata_id: number | null;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare FrontIdCard?: NonAttribute<S3Metadata | null>;
    declare RearIdCard?: NonAttribute<S3Metadata | null>;

    static associate() {
        IdCard.belongsTo(S3Metadata, {
            foreignKey: "front_s3_metadata_id",
            as: "FrontIdCard",
        });
        IdCard.belongsTo(S3Metadata, {
            foreignKey: "rear_s3_metadata_id",
            as: "RearIdCard",
        });
        IdCard.hasOne(User, {
            foreignKey: "idcard_id",
        });
        IdCard.hasOne(ShopSignup, {
            foreignKey: "idcard_id",
        });
        IdCard.hasOne(ShopInfo, {
            foreignKey: "idcard_id",
        });
        IdCard.hasOne(ShopInfoEdit, {
            foreignKey: "idcard_id",
        });
    }

    static associations: {
        FrontIdCard: Association<IdCard, S3Metadata>;
        RearIdCard: Association<IdCard, S3Metadata>;
        User: Association<IdCard, User>;
        ShopSignup: Association<IdCard, ShopSignup>;
        ShopInfo: Association<IdCard, ShopInfo>;
        ShopInfoEdit: Association<IdCard, ShopInfoEdit>;
    };
}

IdCard.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        front_s3_metadata_id: {
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
        rear_s3_metadata_id: {
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
        modelName: "IdCard",
        tableName: "id_card",
        freezeTableName: true,
        timestamps: true,
    },
);

export default IdCard;
