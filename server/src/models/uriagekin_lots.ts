import { Association, DataTypes, Model } from "sequelize";
import sequelize from "../db.js";

import User from "./user.js";

export class UriagekinLots extends Model {
    declare id: number;
    declare uriagekin: number;
    declare user_id: number;
    declare used_uriagekin: number;
    declare expires_at: Date;
    declare createdAt: Date;
    declare updatedAt: Date;

    static associate() {
        UriagekinLots.belongsTo(User, {
            foreignKey: "user_id",
        });
    }

    static associations: {
        User: Association<UriagekinLots, User>;
    };
}

UriagekinLots.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        uriagekin: {
            type: DataTypes.INTEGER,
            allowNull: false,
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
        used_uriagekin: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        expires_at: {
            type: DataTypes.DATE,
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
        modelName: "UriagekinLots",
        tableName: "uriagekin_lots",
        freezeTableName: true,
        timestamps: true,
    },
);

export default UriagekinLots;
