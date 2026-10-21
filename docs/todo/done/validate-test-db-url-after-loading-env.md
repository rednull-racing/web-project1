# テスト用DB設定を読み込んでから接続先を検証する

## 問題と原因

2026-10-16、createItemEditingDraftのRouterテスト調査で、`server/src/db.ts`のtest分岐が`.env.test`を読む前に`process.env.DATABASE_URL`を必須検査していることを確認した。`NODE_ENV=test`とserver/.env.testの設定だけでは、親processにDATABASE_URLがなければ`DATABASE_URL is not set!`で止まる。

さらにDB名の検査後に`dotenv.config({ path: ".env.test", override: true })`を実行するため、検査したURLとSequelizeに渡す最終URLが異なる可能性がある。現在の.env.testの接続先が不正だったことを示すものではなく、初期化順序から確認できる検査の不足である。

Routerのモック漏れは別途解消済み。このTodoではDB非接続テストへDB設定を持ち込まない。

## 修正方針・対象ファイル

- `server/src/db.ts`で.env.testを読み込んだ後、Sequelizeへ渡す最終値の存在・URL形式・DB名=test_dbを検査する。設定ファイルの読込み失敗時に親processの値で続行するかも、既存のDBテストの読込元保証と整合させる。
- `server/test/fixtures/**/databaseSetup.ts`のdotenvモックと接続ガードを調査し、既存の安全条件を維持する。全接続で最終設定値が検査済みになることを確認する。
- 実DB接続なしのテストで、親processのURLなし・正常な.env.test、ファイル読込み失敗、URL欠落・不正、test_db以外、override前後でDB名が変わる場合を検証する。dotenvとSequelizeを境界でモックし、拒否時にはSequelizeが生成されないことを確認する。
- development・productionの挙動やモデル・migrationは変更しない。URL・認証情報を出力しない。
- server/で対象テスト、lint、typecheck、テスト全体型検査を実施する。DB接続・migration実行は不要。

## 解決結果（2026-10-16）

.env.test読込み後にファイル内URLと最終URL・NODE_ENV・PostgreSQL・ホスト・DB名test_dbを検証するよう修正。読込み失敗・URL欠落時は親processへフォールバックせず、Sequelize生成前に停止する。

DB非接続の単体テスト22件・lint・本番/テスト全体型検査が成功。既存4種のdatabaseSetupのparsed返却と一致検査の互換性を調査した。DB接続・migrationは実行していない。

詳細は [検証レポート](../../../server/test/docs/report/database/initialization.md) を参照。
