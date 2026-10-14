import { Model, DataTypes, Association } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import User from "./user.js";

export class TokenSignupVerification extends Model {
    declare id: number;
    declare verification_code: string;
    declare verification_code_expires: Date;
    declare reissue_token: string;
    declare reissue_token_expires: Date;
    declare user_id: number;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare User?: NonAttribute<User | null>;

    static associate() {
        TokenSignupVerification.belongsTo(User, {
            foreignKey: "user_id",
        });
    }

    static associations: {
        User: Association<TokenSignupVerification, User>;
    };
}

TokenSignupVerification.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        verification_code: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
        },
        verification_code_expires: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        reissue_token: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
        },
        reissue_token_expires: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: "user",
                key: "id",
            },
            onUpdate: "NO ACTION",
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
        modelName: "TokenSignupVerification",
        tableName: "token_signup_verification",
        freezeTableName: true,
        timestamps: true,
    },
);

export default TokenSignupVerification;
