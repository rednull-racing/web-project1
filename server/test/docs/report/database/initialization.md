# DB初期化の修正・検証結果（2026-10-16）

`src/test/db.test.ts`の22件すべて成功。失敗・skip・todo・未処理例外は0件。実DB接続なし。設計は [initialization.md](../../architecture/database/initialization.md) を参照。

## 原因と修正

`src/db.ts`は.env.test読込み前に親processのURLを検査し、検査後にoverrideしていた。ファイルに正常な設定があっても親URLがなければ停止し、上書き後の接続先は再検証していなかった。

test分岐を「読込み → 読込み成功・ファイル内URLの存在 → NODE_ENVと最終URLの一致 → PostgreSQL・ホスト・DB名test_dbの検査 → Sequelize生成」の順に変更した。読込み失敗・ファイル内URL欠落時に親URLへフォールバックしない。URLパース失敗は接続情報を含まない固定メッセージへ変換する。development・production・Dockerの処理は変更していない。

## ケースと結果

| ケース | 件数 | 確認結果 |
| --- | ---: | --- |
| N01 | 4 | 親URLなし・正常・別DBからの上書き、postgresqlプロトコルの正常初期化 |
| E01 | 4 | 読込み失敗・parsedなし・URL欠落・空文字で親URLを採用せず生成前停止 |
| E02 | 6 | 不正URL・別DB・https・mysql・ホストなし・余分なパスを生成前に拒否、固定エラーでURL非公開 |
| E03 | 3 | parsedと最終URLの不一致2件・NODE_ENV上書きを生成前に拒否 |
| N02 | 1 | DB_SSL=trueのSSLオプション維持 |
| R01 | 4 | development・production・Dockerの読込み条件、productionのURL欠落時停止 |

実db.tsを動的importし、dotenv.configとSequelizeコンストラクタをモックした。ケースごとにモジュール・モック・環境変数を初期化し、環境変数は終了時に復元する。実設定ファイルや認証情報は使用していない。

## 既存DBテストとの関係

`test/fixtures/itemDraft/createItemDraft`と`test/fixtures/itemEditing/{createItemEditingDraft,createItemEditingCopy,updateConfirm}`のdatabaseSetupを確認した。いずれも.env.testを事前検証して環境変数へ設定し、dotenv.configから同じparsedを返すため、今回の存在・一致検査に適合する。各databaseFixturesはアプリ用・models用・observer（および該当するcompetitor）の接続に対する`SELECT current_database()`等の既存ガードを維持する。

models/index.tsは独自のSequelize初期化を持つ。今回の変更範囲はdb.tsであり、全接続がdb.tsを経由するという意味ではない。既存ガードの実通信・DB保存・transaction・後片付けは今回未実行。fixture・models・環境設定・migrationの変更なし。

## 実行方法と結果

server/で以下を実行し、すべて成功した。

```bash
npm run test:run -- src/test/db.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

テスト初版のテスト全体型検査ではit.eachの空オブジェクト推論に1件の型エラーがあり、Record型の明示後に再検査して解消した。lintはsrc/testも対象。本番typecheckはテストを除外し、テスト用tsconfigで単体・結合テスト全体を検査した。カバレッジ取得・実DB接続・migrationは行っていない。
