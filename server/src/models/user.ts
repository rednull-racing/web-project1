import { Association, DataTypes, Model } from "sequelize";
import type { NonAttribute } from "sequelize";
import sequelize from "../db.js";

import Address from "./address.js";
import BankAccount from "./bank_account.js";
import Cart from "./cart.js";
import CommentLike from "./comment_like.js";
import Follow from "./follow.js";
import GenderOption from "./gender_option.js";
import IdCard from "./id_card.js";
import Item from "./item.js";
import ItemLike from "./item_like.js";
import Name from "./name.js";
import Notification from "./notification.js";
import PointLots from "./point_lots.js";
import PointsHistory from "./points_history.js";
import ReferenceCode from "./reference_code.js";
import ShopInfo from "./shop_info.js";
import ShopSignup from "./shop_signup.js";
import UriagekinHistory from "./uriagekin_history.js";
import UriagekinLots from "./uriagekin_lots.js";
import WatchHistory from "./watch_history.js";

export class User extends Model {
    declare id: number;
    declare user_name: string | null;
    declare user_introduction: string | null;
    declare profile_image: string | null;
    declare penalty_points: number | null;
    declare early_seller: boolean | null;
    declare honnin_verified: boolean | null;
    declare admin: boolean | null;
    declare createdAt: Date;
    declare email: string;
    declare updatedAt: Date;
    declare campaign_points: number | null;
    declare campaign_points_sum: number | null;
    declare password: string;
    declare points: number | null;
    declare uriagekin: number | null;
    declare star_amount: number | null;
    declare star_average: number | null;
    declare gender_id: number | null;
    declare birthday: Date | null;
    declare phone_number: string | null;
    declare honnin_verify_request: boolean | null;
    declare email_verified: boolean | null;
    declare report_trust_score: number;
    declare address_id: number | null;
    declare name_id: number | null;
    declare account_id: number | null;
    declare idcard_id: number | null;

    declare Address?: NonAttribute<Address | null>;
    declare BankAccount?: NonAttribute<BankAccount | null>;
    declare IdCard?: NonAttribute<IdCard | null>;
    declare Name?: NonAttribute<Name | null>;
    declare PointLots?: NonAttribute<PointLots[]>;
    declare ShopInfo?: NonAttribute<ShopInfo | null>;
    declare UriagekinLots?: NonAttribute<UriagekinLots[]>;

    static associate() {
        User.belongsTo(Address, {
            foreignKey: "address_id",
        });
        User.belongsTo(Name, {
            foreignKey: "name_id",
        });
        User.belongsTo(BankAccount, {
            foreignKey: "account_id",
        });
        User.belongsTo(GenderOption, {
            foreignKey: "gender_id",
        });
        User.belongsTo(IdCard, {
            foreignKey: "idcard_id",
        });
        User.hasOne(ShopInfo, {
            foreignKey: "user_id",
        });
        User.hasOne(ReferenceCode, {
            foreignKey: "input_user_id",
            as: "Input",
        });
        User.hasMany(Cart, {
            foreignKey: "user_id",
        });
        User.hasMany(Follow, {
            foreignKey: "follow_user_id",
            as: "FollowUser",
        });
        User.hasMany(Follow, {
            foreignKey: "follower_user_id",
            as: "FollowerUser",
        });
        User.hasMany(CommentLike, {
            foreignKey: "user_id",
        });
        User.hasMany(ItemLike, {
            foreignKey: "user_id",
        });
        User.hasMany(Item, {
            foreignKey: "seller_id",
        });
        User.hasMany(ReferenceCode, {
            foreignKey: "output_user_id",
            as: "Output",
        });
        User.hasMany(Notification, {
            foreignKey: "read_user_id",
        });
        User.hasMany(WatchHistory, {
            foreignKey: "user_id",
        });
        User.hasMany(PointsHistory, {
            foreignKey: "user_id",
        });
        User.hasMany(PointLots, {
            foreignKey: "user_id",
        });
        User.hasMany(ShopSignup, {
            foreignKey: "user_id",
        });
        User.hasMany(UriagekinHistory, {
            foreignKey: "user_id",
        });
        User.hasMany(UriagekinLots, {
            foreignKey: "user_id",
        });
    }

    static associations: {
        Cart: Association<User, Cart>;
        FollowUser: Association<User, Follow>;
        FollowerUser: Association<User, Follow>;
        CommentLike: Association<User, CommentLike>;
        ItemLike: Association<User, ItemLike>;
        Item: Association<User, Item>;
        Input: Association<User, ReferenceCode>;
        Output: Association<User, ReferenceCode>;
        Notification: Association<User, Notification>;
        IdCard: Association<User, IdCard>;
        ShopInfo: Association<User, ShopInfo>;
        ShopSignup: Association<User, ShopSignup>;
        Address: Association<User, Address>;
        BankAccount: Association<User, BankAccount>;
        WatchHistory: Association<User, WatchHistory>;
        Name: Association<User, Name>;
        GenderOption: Association<User, GenderOption>;
        PointsHistory: Association<User, PointsHistory>;
        PointLots: Association<User, PointLots>;
        UriagekinHistory: Association<User, UriagekinHistory>;
        UriagekinLots: Association<User, UriagekinLots>;
    };
}

User.init(
    {
        id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
        },
        user_name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        user_introduction: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        profile_image: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        penalty_points: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        early_seller: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        honnin_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        admin: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        email: {
            type: DataTypes.STRING(255),
            allowNull: false,
            validate: {
                isEmail: true,
            },
        },
        campaign_points: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        campaign_points_sum: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        points: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        uriagekin: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        star_amount: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0,
        },
        star_average: {
            type: DataTypes.DECIMAL,
            allowNull: true,
            defaultValue: 0,
        },
        gender_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: "gender_option",
                key: "id",
            },
            onUpdate: "NO ACTION",
            onDelete: "NO ACTION",
        },
        birthday: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        phone_number: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        honnin_verify_request: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        email_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
        },
        report_trust_score: {
            type: DataTypes.DECIMAL,
            defaultValue: 0.3,
            allowNull: false,
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
        name_id: {
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
    },
    {
        sequelize,
        modelName: "User",
        tableName: "user",
        freezeTableName: true,
        timestamps: true,
    },
);

export default User;
