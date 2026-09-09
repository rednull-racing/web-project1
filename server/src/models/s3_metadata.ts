import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import IdCard from "./id_card.js";
import PermitFile from "./permit.js";

export class S3Metadata extends Model {
    declare id: number;

    declare bucket_name: string;
    declare object_key: string;

    declare version_id: string | null;

    declare original_file_name: string | null;
    declare content_type: string;
    declare file_size: number;

    declare etag: string | null;

    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        S3Metadata.hasOne(IdCard, {
            foreignKey: "front_s3_metadata_id",
            as: "FrontIdCard",
        });
        S3Metadata.hasOne(IdCard, {
            foreignKey: "rear_s3_metadata_id",
            as: "RearIdCard",
        });
        S3Metadata.hasOne(PermitFile, {
            foreignKey: "s3_metadata_id",
            as: "RearIdCard",
        });
    }

    static associations: {
        FrontIdCard: Association<S3Metadata, IdCard>;
        RearIdCard: Association<S3Metadata, IdCard>;
        PermitFile: Association<S3Metadata, PermitFile>;
    };
}

S3Metadata.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        bucket_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        object_key: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        version_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        original_file_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        content_type: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        file_size: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        etag: {
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
    },
    {
        sequelize,
        modelName: "S3Metadata",
        tableName: "s3_metadata",
        freezeTableName: true,
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ["bucket_name", "object_key"],
                name: "uq_s_metadata_bucket_name_object_key",
            },
        ],
    },
);

export default S3Metadata;
