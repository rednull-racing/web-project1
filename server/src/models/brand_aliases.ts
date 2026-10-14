import { Model, DataTypes, Association } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";
import Brands from "./brands.js";

export class BrandAliases extends Model {
    declare id: number;
    declare brand_id: number | null;
    declare name: string | null;
    declare name_normalized: string | null;

    declare brand?: NonAttribute<Brands | null>;

    static associate() {
        BrandAliases.belongsTo(Brands, {
            foreignKey: "brand_id",
            as: "brand",
        });
    }

    static associations: {
        brand: Association<BrandAliases, Brands>;
    };
}

BrandAliases.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        brand_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "brands",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        name_normalized: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
    },
    {
        sequelize,
        modelName: "BrandAliases",
        tableName: "brand_aliases",
        freezeTableName: true,
        timestamps: false,
    },
);

export default BrandAliases;
