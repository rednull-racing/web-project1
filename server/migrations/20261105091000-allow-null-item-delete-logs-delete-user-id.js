"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        // PostgreSQLでは外部キー定義を含むchangeColumnがNULL制約変更を省略するため分ける。
        await queryInterface.changeColumn("item_delete_logs", "delete_user_id", {
            type: Sequelize.INTEGER,
            allowNull: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.changeColumn("item_delete_logs", "delete_user_id", {
            type: Sequelize.INTEGER,
            allowNull: false,
        });
    },
};
