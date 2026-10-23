# マイグレーション作成マニュアル

## マイグレーションファイル作成

/serverのコマンドで実行

```bash
npm run migration:generate -- --name ファイル名
```

## マイグレーションファイルの書き方

### CommonJSからESMへの書き換え

npx sequelize-cli migration:generateだと、CommonJSでファイルが生成されるが、package.jsonに"type": "module"と設定しているため、**マイグレーションファイルをCommonJSからESMに書き換える必要がある**。

```js
// CommonJS
module.exports = {
    async up(...) {
        ...
    },

    async down(...) {
        ...
    },
};

// ESM
export default {
    async up(...) {
        ...
    },

    async down(...) {
        ...
    },
};

```

**module.exports =**の部分を**export default**に書き換えるだけ！

### テーブル作成

```js
"use strict";

/** @type {import('sequelize-cli').Migration} */
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable("テーブル名", {
            // カラム

            // Example:
            id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                autoIncrement: true,
                primaryKey: true,
            },
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable("テーブル名");
    },
};
```

### カラム追加

```js
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn("テーブル名", "カラム名", {
            // 制約

            // Example:
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn("テーブル名", "カラム名");
    },
};
```

### カラム削除

```js
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.removeColumn("テーブル名", "カラム名");
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.addColumn("テーブル名", "カラム名", {
            // 制約

            // Example:
            type: Sequelize.INTEGER,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
        });
    },
};
```

### 外部キー追加

```js
export default {
    async up(queryInterface, Sequelize) {
        await queryInterface.addConstRaint("テーブル名", {
            // 外部キー制約

            // Example:
            fields: ["カラム名"],
            type: "foreign key",
            name: "fk_points_history_カラム名", // 制約名
            references: {
                table: "リレーション先テーブル名",
                field: "id（主キー）",
            },
            onUpdate: "",
            onDelete: "",
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeConstraint("テーブル名", "制約名");
    },
};
```

#### onUpdate, onDelete

```
CASCADE    親レコードが削除されたら子レコードも削除
SET NULL   外部キーをNULLにする
RESTRICT   子レコードがある場合削除禁止
```

## マイグレーション実行

/serverのコマンドで実行

```bash
npx sequelize-cli db:migrate
```

## Node.js 26での実行・環境指定

`server/` でpackage.jsonのNode.js要件を満たすバージョンを使う。
`.sequelizerc` はESMで、Node.jsの `"module.exports"` exportを使ってCLIのrequireへ設定を渡す。
[Node.jsの相互運用仕様](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require)を参照。
明示options指定のnpmコマンドと、直接の `npx sequelize-cli` は同じESM設定を参照する。

```bash
npm run migration:generate -- --name add-example-column
npm run migration:run -- --help
npm run migration:revert -- --help
# 読込み・呼出し・履歴の隔離検証（DBへの書込みなし）
node --test --test-isolation=none config/test/migration-cli.test.js
```

生成されたCommonJS雛形は、上記のとおりESMに直し、up/downを記述する。
既存migrationにはトップレベルawaitを追加しない。CLI内のUmzugはrequireで同期読込みする。

接続設定は `server/config/config.js` に集約し、`--env` を `NODE_ENV` より優先する。
開発は `.env`（外部DATABASE_URL優先）、testは `.env.test` の値のみを使う。
testのDATABASE_URLがない・不正・DB名がtest_db以外なら中断し、親環境のURLにはフォールバックしない。
productionは外部環境変数を使う。SSLは各設定元の `DB_SSL=true` で有効にする。

以下は**対象DBとmigrationの実行許可を得た後**に使う運用例。この修正の検証では実行していない。

```bash
# 適用対象・現在の履歴を先に確認する（statusも履歴テーブル未作成時は作成し得る）
npx sequelize-cli db:migrate:status --env test
# 指定ファイルまでの未適用migrationをすべて実行する。事前確認必須。
npm run migration:run -- --env test --to <migration-file.js>
# 指定した適用済みmigrationを復旧。downのデータ影響・依存を先に確認する。
npm run migration:revert -- --env test --name <migration-file.js>
```

開発は `--env development`、本番は `--env production` を明示する。
`SequelizeMeta.name` は既存のファイル名を維持する。専用スクリプトで記録済みの履歴も消さない。
履歴の削除やDBリセット、sequelize.sync()で互換性の問題を解決しない。
