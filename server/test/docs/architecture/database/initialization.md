# DB初期化のテスト設計

## 対象と契約

`server/src/db.ts`のtest分岐で、`.env.test`読込み後の最終DATABASE_URLを検証する。ファイル読込み失敗・URL欠落時は親processの値へフォールバックしない。PostgreSQLのtest_db以外、NODE_ENVの変更、読込値と最終値の不一致はSequelize生成前に拒否する。development・production・Docker分岐は既存の挙動を維持する。

## 境界とケース

`server/src/test/db.test.ts`で実db.tsを再importし、dotenv.configとSequelizeコンストラクタをモックする。実ファイル・DB・AWSにはアクセスしない。vi.stubEnvとresetModulesでケースを分離し、afterEachで復元する。

- N01：親URLなし／あり（別DB含む）でも.env.testの正常URLで初期化する。設定ファイル・override・コンストラクタ引数を確認する。
- E01：読込み失敗・parsedなし・ファイル内URLなし／空文字は、親URLが正常でも拒否する。
- E02：不正URL・非PostgreSQL・test_db以外・余分なパス・ホストなしは生成前に拒否する。エラーにURLを含めない。
- E03：検査前後でURLが変わる場合、読込結果と最終値の不一致やNODE_ENVの上書きを拒否する。
- N02：DB_SSL=trueのオプションを維持する。
- R01：development・production・Dockerの既存設定読込みとオプションを維持する。

server/で対象Vitest、lint、本番typecheck、test/tsconfig.jsonの型検査を実施する。実DBの接続・全接続ガードの実通信検証・migrationは対象外。既存databaseSetupのdotenvモックは検証済みparsedを返す契約を維持する。
