"use strict";

const tables = ["item_draft", "item_trash"];
const columns = ["before_price", "discount_rate", "discount_amount", "sale_flag"];

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            for (const table of tables) {
                for (const column of columns) {
                    await queryInterface.removeColumn(table, column, { transaction });
                }
            }
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            // カラム定義のみ復元する。削除した割引情報の値は復元できない。
            for (const table of [...tables].reverse()) {
                for (const column of [...columns].reverse()) {
                    await queryInterface.addColumn(table, column, column === "sale_flag" ? {
                        type: Sequelize.BOOLEAN,
                        allowNull: false,
                        defaultValue: false,
                    } : {
                        type: Sequelize.INTEGER,
                        allowNull: true,
                    }, { transaction });
                }
            }
        });
    },
};
