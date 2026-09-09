"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const tableName of ["shop_info", "shop_info_edit", "shop_signup"]) {
                await queryInterface.removeColumn(tableName, "permit_id", { transaction });
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const tableName of ["shop_signup", "shop_info_edit", "shop_info"]) {
                await queryInterface.addColumn(
                    tableName,
                    "permit_id",
                    {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                        unique: true,
                        references: {
                            model: "permit",
                            key: "id",
                        },
                        onUpdate: "CASCADE",
                        onDelete: "SET NULL",
                    },
                    { transaction },
                );
            }
        });
    },
};
