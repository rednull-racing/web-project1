# cronDeleteItemEditing 統合レポート

実行日: 2026-10-21。パスはserver/基準。
最新結果: **完了**。新規単体14件、既存回帰374件、実DB7件が成功（重複なし計395件、9ファイル）。
lint・本番型検査・テスト型検査・test配下追加lint・migration構文検査が成功。
必須ケースの未実装・未実行・skip・失敗・未処理例外は残っていない。カバレッジは未取得。

[詳細設計](../../../../../docs/design/backend/detail/itemEditing/cronDeleteItemEditing.md) /
[テスト設計](../../architecture/itemEditing/cronDeleteItemEditing.md)

## 実装内容

- `src/cron/itemEditingDelete.ts`を追加し、`src/cron/index.ts`から登録。毎日12時JST、成功件数/失敗をログ出力。
- `src/usecases/itemEditing/cronDeleteItemEditing.ts`で実行時刻から72時間前を算出しmanaged transactionを管理。
- `src/services/itemEditing/command.ts`へ`destroyExpiredItemEditings`を追加。createdAtのlte条件で一括削除し実件数を返す。
- 対象なしは0件成功。updatedAt・所有者・動画状態で除外せず、商品/下書き/S3を削除しない。
- 実DB検査で見つかったitemの日時NULL制約不一致は、ユーザーの追加指示に従って新migrationで両DBへ反映した。

## 最新テスト結果

| ファイル                                                                     | レベル       | 成功件数 | 設計ケース                                                 |
| ---------------------------------------------------------------------------- | ------------ | -------: | ---------------------------------------------------------- |
| src/usecases/itemEditing/test/cronDeleteItemEditing.test.ts                  | 単体         |        6 | U01〜U04。期限・件数・transaction参照・削除/完了待機・例外 |
| src/services/itemEditing/test/cronDeleteItemEditing.test.ts                  | 単体         |        3 | S01〜S02。lte・transaction・返却・例外                     |
| src/cron/test/itemEditingDelete.test.ts                                      | 単体         |        4 | C01〜C03。schedule・JST・完了後ログ・失敗捕捉・次回実行    |
| src/cron/test/index.itemEditingDelete.test.ts                                | 起動接続単体 |        1 | C04。startAllCronsから開始関数を呼ぶ                       |
| src/services/itemEditing/test/createItem.test.ts                             | 既存単体回帰 |        3 | 所有者検索/行ロック・既存編集行削除                        |
| src/services/itemEditing/test/createItemEditingDraft.test.ts                 | 既存単体回帰 |        4 | 既存編集行生成・例外・待機                                 |
| src/services/itemEditing/test/createItemEditingCopy.test.ts                  | 既存単体回帰 |        2 | 既存コピー生成・例外                                       |
| src/usecases/items/create/test/createItem.test.ts                            | 既存単体回帰 |      365 | 公開処理・編集行消費・途中失敗など                         |
| test/integration/usecases/itemEditing/cronDeleteItemEditing/database.test.ts | 実DB         |        7 | D01〜D05。D04とD05は各2条件                                |

最新DB実行: 16:17:19 JST、1ファイル7 passed、失敗/skipなし、exit 0。
最新単体・回帰実行: 16:17:43 JST、8ファイル388 passed、失敗/skipなし、exit 0。
単体ファイル別件数は実装された展開条件と、初回14件・既存service回帰9件・最終388件のランナー集計を照合した。
読み取り専用のスキーマ調査用一時テストは上記395件に加算していない。

## 実DBの保証と安全確認

- 読込元は`server/.env.test`、NODE_ENV=test。PostgreSQL・設定DB名test_dbを初期化前に検査し、dotenvの別ファイル読込みを遮断した。
- `src/db.ts`と`src/models/index.ts`の両Sequelize接続でcurrent_database()=test_dbを確認。observer・competitor用の追加Sequelizeインスタンスは作らず、同じプールの独立connection/transactionを使用した。
- fixture書込み前にItemEditing/ItemDraft/Itemの全Model列の存在とNULL制約、item_editingの主キー・createdAt型、incoming FK不在を検査した。
- 固定時刻1900-01-04T03:00Zを使い、既存の期限行がないことを検査。毎回のrun前にも削除対象が自作IDのみか確認した。日常の既存データを期限削除していない。
- D01: 期限の-1ms/一致を削除し、+1ms/未来は全列保持。新しいupdatedAt・所有者null・動画処理中/セールフラグありでも期限行を削除した。古いItem/ItemDraftを全列保持し、再実行0件。
- D02: 実DELETEの2件削除と同一transaction内の対象消失を確認後throw。rollback後の新規SELECTで全行・全列復元を確認し、再試行2件成功。
- D03: 実DELETE後のgateでtransactionを保留。別connectionのSELECTではcommit前に元行が見え、完了後は対象行が消失した。
- D04: READ COMMITTEDを確認。先行transactionで対象1行を実DELETEし、pg_blocking_pidsとDELETE文の実行中connectionを使って後続の実待機を観測。先行commit時は後続1件、rollback時は2件削除。期限外行は保持した。
- D05: Model validationを迂回して自作Itemの日時へSQLでNULL代入を試み、両列ともSQLSTATE 23502と対象カラムを確認。rollback後に全列不変。
- afterCreateでIDを追跡し、自作IDだけcleanup、残存0件をassertした。全gate/Promise/transactionを回収し、hook/spyを解除、両接続close成功後にenvを復元した。

テストは実usecase・service・Model・DBを通す。D02/D03のspyは実DELETEを呼んだ後に障害/gateを置く。
単体のtransactionモック成功は実rollbackや実ロックの根拠に含めていない。

## 実DB・テストDBのマイグレーション

2026-10-21のユーザー指示「実DB、テストDBともにitemのcreatedAt, updatedAtがNOT NULLになった状態」で実行した。

対象: `migrations/20261021071500-enforce-item-timestamps-not-null.js`。
upは同一transactionでpublic.itemのcreatedAt/updatedAtをSET NOT NULL、downは両列をDROP NOT NULLする。
カラム型・default・既存値は変更せず、NULLの自動補完も行わない。適用時にNULLがあればDB制約検査で中断する。
既存migrationやModelは変更していない。

| 接続設定  | 設定/実DB名       | 適用前NULL件数 createdAt/updatedAt | 適用後             | SequelizeMeta     |
| --------- | ----------------- | ---------------------------------- | ------------------ | ----------------- |
| .env      | neondb / neondb   | 0 / 0                              | 両列is_nullable=NO | 今回ファイル名1件 |
| .env.test | test_db / test_db | 0 / 0                              | 両列is_nullable=NO | 今回ファイル名1件 |

一時runnerを作成し、server/で`node tmp/enforceItemTimestamps.mjs --apply`を実行（exit 0）。
両接続の設定DB名・current_database・NULL0件・SequelizeMetaを変更前に検査し、対象migrationのupだけを実行して履歴を記録、両列と履歴を再取得して検証した。
他のpending migrationは実行していない。全接続終了も成功。認証情報・接続URLは出力していない。
実DBではスキーマと履歴・NULL件数の読取りを行い、テストデータ作成やCron本体の削除テストはtest_dbだけで行った。
downは本番制約を戻すため実行していない。up/downの構文検査は成功した。

## 実行コマンドと静的検査

すべてserver/で実行。

```bash
npm run test:run -- src/usecases/itemEditing/test/cronDeleteItemEditing.test.ts src/services/itemEditing/test/cronDeleteItemEditing.test.ts src/cron/test/itemEditingDelete.test.ts src/cron/test/index.itemEditingDelete.test.ts src/services/itemEditing/test/createItem.test.ts src/services/itemEditing/test/createItemEditingDraft.test.ts src/services/itemEditing/test/createItemEditingCopy.test.ts src/usecases/items/create/test/createItem.test.ts
npm run test:run -- test/integration/usecases/itemEditing/cronDeleteItemEditing/ --maxWorkers=1
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint --config /tmp/cron-delete-item-editing-eslint.config.mjs test/fixtures/itemEditing/cronDeleteItemEditing test/integration/usecases/itemEditing/cronDeleteItemEditing
node --check migrations/20261021071500-enforce-item-timestamps-not-null.js
```

静的検査はすべてexit 0。本番typecheckはsrc配下testを除外し、test/tsconfigで単体・結合・fixtureを追加検査した。
追加lintは通常対象外のtest配下TSに既存ESLint recommended・typescript-eslint recommendedを適用する一時configを使用。共有設定・依存ライブラリは変更していない。
maxWorkers=1は共有DBの期限テストを他ファイルと同時実行しないため。ケース内の競合は独立transactionで別に実施した。

## 初回失敗・修正履歴（すべて解消済み）

| 修正ID | 発生箇所・元ケース       | 観測と原因                                                                                                                                     | 修正・再検証                                                                                                                                                   |
| ------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1     | DB fixture、テスト型検査 | 異なるModelのMap/配列の型推論とafterCreateのpush戻り値で型エラー                                                                               | ModelStatic<Model>を明示しhookはvoidへ修正。最終テスト型検査exit 0                                                                                             |
| F2     | DB接続前提、D01〜D04     | 初回サンドボックスでEPERM、1ファイル失敗・5 skipped（本体未実行）                                                                              | 接続権限取得後、同じ安全ガードで再実行                                                                                                                         |
| F3     | スキーマ検査、D01〜D04   | 接続後item.createdAtのnullable不一致で停止。1ファイル失敗・5 skipped、書込みなし。追加読取りでupdatedAtもYES、両列NULL0件と確認                | ユーザーの仕様確認と明示的な両DB適用指示後、新migrationで解消。D05を追加                                                                                       |
| F4     | 待機監視SQL、D04         | migration後の初回は3 passed/2 failed。replacementsの`:blocker=ANY`が置換されずSQL構文エラー。finallyのrollbackでcommitケースの件数assertも失敗 | bindのCAST($blocker AS integer)へ変更。結果回収とassertを分離して元失敗を隠さないfinallyに修正。seedを逐次実行し途中失敗時も未回収作成を残さない。最終7 passed |

準備中にルートでtest:runを呼んだ1回はMissing scriptで停止し、テストランナーは起動していない。server/から実行し直した。
初回の未実行/skipや中断状態は上記の履歴であり、最新結果へ合算していない。

## 保証の限界

実時計で翌日まで待つCron起動、複数サーバー全体のジョブ起動抑止、S3実体削除・通信、COMMIT応答喪失時の成否は対象外。
HTTP経路は存在せず、認証・レート制限・HTTP応答の検証も対象外。
実DBの全列型/default/FK等を網羅した監査ではなく、今回必要なスキーマと削除/NULL制約を検証した。
未解決事項はない。
