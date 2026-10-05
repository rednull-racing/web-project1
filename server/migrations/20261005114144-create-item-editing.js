"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable(
                "item_editing",
                {
                    id: {
                        type: Sequelize.INTEGER,
                        allowNull: false,
                        primaryKey: true,
                        autoIncrement: true,
                    },
                    item_id: {
                        type: Sequelize.INTEGER,
                        allowNull: false,
                        references: {
                            model: "item",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "CASCADE",
                    },
                    name: {
                        type: Sequelize.STRING(255),
                        allowNull: true,
                    },
                    detail: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    image_url: {
                        type: Sequelize.ARRAY(Sequelize.TEXT),
                        allowNull: true,
                    },
                    price: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                    },
                    item_condition_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "item_condition_option",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "NO ACTION",
                    },
                    seller_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "user",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "NO ACTION",
                    },
                    first_image_url: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    gender_type: {
                        type: Sequelize.ENUM("men", "women", "unisex"),
                        allowNull: false,
                        defaultValue: "unisex",
                    },
                    age_type: {
                        type: Sequelize.ENUM("adult", "kids", "both"),
                        allowNull: false,
                        defaultValue: "both",
                    },
                    recommend: {
                        type: Sequelize.BOOLEAN,
                        allowNull: true,
                        defaultValue: false,
                    },
                    category_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "categories",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "NO ACTION",
                    },
                    brand_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "brands",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "SET NULL",
                    },
                    brand_aliases_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "brand_aliases",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "SET NULL",
                    },
                    attributes: {
                        type: Sequelize.JSONB,
                        allowNull: false,
                        defaultValue: {},
                    },
                    thumbnail_url: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    title: {
                        type: Sequelize.STRING(255),
                        allowNull: true,
                    },
                    summary: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    duration: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                    },
                    original_url: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    converted_url: {
                        type: Sequelize.TEXT,
                        allowNull: true,
                    },
                    video_status: {
                        type: Sequelize.STRING(255),
                        allowNull: true,
                    },
                    before_price: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                    },
                    discount_rate: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                    },
                    discount_amount: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                    },
                    sale_flag: {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: false,
                    },
                    shipping_day_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "shipping_day_option",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "NO ACTION",
                    },
                    shipping_service_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "shipping_service_option",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "NO ACTION",
                    },
                    shipping_place_id: {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        references: {
                            model: "todouhuken_option",
                            key: "id",
                        },
                        onUpdate: "NO ACTION",
                        onDelete: "NO ACTION",
                    },
                    shipping_service_free_text: {
                        type: Sequelize.STRING(255),
                        allowNull: true,
                    },
                    createdAt: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
                    },
                    updatedAt: {
                        type: Sequelize.DATE,
                        allowNull: false,
                        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
                    },
                },
                { transaction },
            );
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable("item_editing", { transaction });
            await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_item_editing_age_type";', { transaction });
            await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_item_editing_gender_type";', { transaction });
        });
    },
};
