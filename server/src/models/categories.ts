import { Model, DataTypes, Association } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";
import type { BodyCategory, LifeStyleCategory, Layer } from "../types/itemAttributes.js";
import CouponCategory from "./coupon_category.js";

export class Categories extends Model {
    declare id: number;
    declare name: string;
    declare level: number;
    declare sort_order: number;
    declare parent_id: number | null;
    declare allowed_gender: "men" | "women" | "unisex";
    declare allowed_age: "adult" | "kids" | "both";
    declare body_category: BodyCategory | null;
    declare lifestyle_category: LifeStyleCategory | null;
    declare layer?: Layer | null;
    declare path?: string | null;

    declare parent?: NonAttribute<Categories | null>;

    static associate() {
        Categories.belongsTo(Categories, {
            foreignKey: "parent_id",
            as: "parent",
        });
        Categories.hasMany(Categories, {
            foreignKey: "parent_id",
            as: "children",
        });
        Categories.hasMany(CouponCategory, {
            foreignKey: "category_id",
        });
    }

    static associations: {
        parent: Association<Categories, Categories>;
        children: Association<Categories, Categories>;
        CouponCategory: Association<Categories, CouponCategory>;
    };
}

Categories.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        level: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        parent_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "categories",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "CASCADE",
        },
        allowed_gender: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "unisex",
        },
        allowed_age: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: "both",
        },
        body_category: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        lifestyle_category: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        layer: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        path: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
    },
    {
        sequelize,
        modelName: "Categories",
        tableName: "categories",
        freezeTableName: true,
        timestamps: false,
    },
);

export default Categories;
