# cronDeleteItemEditing テスト設計

設計日: 2026-10-21。パスはserver/基準。
同日のユーザー指示で、実DB・test_dbのitem.createdAt/updatedAtをNOT NULLへ反映し、D05を追加した。
仕様根拠: [詳細設計](../../../../../docs/design/backend/detail/itemEditing/cronDeleteItemEditing.md)。
結果: [統合レポート](../../report/itemEditing/cronDeleteItemEditing.md)。

毎日12時JSTにcreatedAtが72時間以上前のItemEditingだけを物理削除する。
全削除の原子性、実件数、commit待機、非対象行保持を検証する。HTTPの経路は存在しない。

## レベル・配置・境界

| レベル       | ファイル                                                                              | 実処理とモック                                                        |
| ------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Usecase単体  | src/usecases/itemEditing/test/cronDeleteItemEditing.test.ts                           | 実usecase、service・transactionモック                                 |
| Service単体  | src/services/itemEditing/test/cronDeleteItemEditing.test.ts                           | 実service、models/indexのItemEditing.destroyモック、DB非接続          |
| Cron単体     | src/cron/test/itemEditingDelete.test.ts                                               | 実開始関数/callback、schedule・usecaseモック                          |
| 起動接続単体 | src/cron/test/index.itemEditingDelete.test.ts                                         | 実startAllCrons、各開始関数モック                                     |
| 実DB結合     | test/integration/usecases/itemEditing/cronDeleteItemEditing/database.test.ts          | 実usecase・service・Model・PostgreSQL。実DELETE後のspyでgate/例外注入 |
| fixture      | test/fixtures/itemEditing/cronDeleteItemEditing/databaseFixtures.ts、databaseSetup.ts | env検査、スキーマ、ID追跡、時刻固定、seed、cleanup                    |

既存createItemEditingDraftのdatabaseSetupはenv検査・dotenv制御のみ再利用する。
同処理のdatabaseFixturesは旧item_idを要求し、hook/cleanupも広いため再利用しない。
時刻はDate.nowのspyのみで制御し、DBのI/O・実timerは維持する。
単体deferredは既存items/createItem/fixturesから取得する（DB初期化なし）。

## ケース一覧

P0は期限・原子性・失敗停止、P1は起動接続・競合の保証。IDはレベル別で、展開件数とは別。

| ID  | 優先度・レベル | 前提・操作                                                                                    | 期待結果                                                                     |
| --- | -------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| U01 | P0 単体        | 2026-10-21T03:00Z固定、0/3件                                                                  | 期限は18日03:00Z、同じtransaction、実件数返却                                |
| U02 | P0 単体        | 削除Promiseを保留後reject                                                                     | 完了前に返さず、元例外を伝播                                                 |
| U03 | P0 単体        | callback成功後に外側transactionを保留、resolve/reject                                         | 外側完了まで返さず、5件または元例外                                          |
| U04 | P0 単体        | transaction開始reject                                                                         | 削除未実行、元例外伝播                                                       |
| S01 | P0 単体        | 0/4件                                                                                         | Model.destroyを1回、createdAtのOp.lteだけ、期限・transaction同一参照、実件数 |
| S02 | P0 単体        | Model.destroy reject                                                                          | 元例外伝播、再試行なし                                                       |
| C01 | P1 単体        | 開始関数呼出し                                                                                | 0 12 \* \* \*、Asia/Tokyo、即時usecase未実行                                 |
| C02 | P0 単体        | usecaseを保留後0/7件                                                                          | 完了前は成功ログなし、完了後件数ログ、エラーログなし                         |
| C03 | P0 単体        | 1回目失敗、次回成功                                                                           | 元例外をconsole.errorで捕捉、成功ログなし、次回呼出し可能                    |
| C04 | P1 単体        | startAllCrons                                                                                 | ItemEditingの開始関数を1回呼ぶ                                               |
| D01 | P0 実DB        | 期限の-1ms/一致/+1ms・未来、更新は新しく所有者null。古いItem/ItemDraftも作成                  | 前2行のみ2件削除、非対象全列不変、再実行0件                                  |
| D02 | P0 実DB        | 実DELETE後にtransaction内SELECTで消失確認しthrow                                              | 新規SELECTで全行・全列復元、再試行2件                                        |
| D03 | P0 実DB        | 実DELETE後commit前にgate、別connectionからSELECT                                              | commit前は旧行、完了後に対象消失                                             |
| D04 | P1 実DB        | 先行transactionで対象1行を削除し、後続Cron開始、pg_blocking_pidsで実待機観測後commit/rollback | READ COMMITTED。先行commitなら1件、rollbackなら2件、非対象行保持             |
| D05 | P0 実DB        | 自作ItemのcreatedAt/updatedAtへSQLでNULL代入                                                  | 各列でSQLSTATE 23502、rollback後に全列不変                                   |

HTTP入力・認証偽装は経路なしのため対象外。所有者nullも削除対象であり拒否しない。
保存内容は判定に使用しないためJSON階層バリデーションは対象外。
S3実通信・OS上の定刻起動・複数サーバーの実起動・実COMMIT応答喪失は未検証範囲。
単体のtransactionモックは実rollback・実ロックの証明とせず、D02〜D04へ分ける。

## 実DB安全条件

接続前に.env.test由来・NODE_ENV=test・PostgreSQL/test_dbを検査し、dotenvの別設定読込みを遮断する。
アプリsequelizeとmodels/indexのsequelizeの両接続でcurrent_database()=test_dbを確認する。
必要な3テーブルのModel列の存在・nullable、item_editingの主キー・日時型とincoming FK不在を確認する。
不一致では書込み前に停止する。今回Model制約変更は行わず、他の全DB制約検査は目的外。

実時刻1900-01-04T03:00Z、期限1900-01-01T03:00Zを使い、既存の期限行があれば書込み前に停止。
runの直前にも全期限行が追跡済みIDのみか確認する。無関係なテストとの同時実行は避ける。
seedの各afterCreateでIDを追跡し、全Promise/gate/transaction回収後に自作IDだけcleanup、残存0件を確認する。
全接続closeを試み、hook/spy/envを復元する。DB作成・migration・sync・全件削除は実行しない。
競合は同じsequelizeプールの独立transaction/connectionを使い、最大5秒で実待機を観測する。

## 実行・完了条件

server/で実行する。

```bash
npm run test:run -- src/usecases/itemEditing/test/cronDeleteItemEditing.test.ts src/services/itemEditing/test/cronDeleteItemEditing.test.ts src/cron/test/itemEditingDelete.test.ts src/cron/test/index.itemEditingDelete.test.ts
npm run test:run -- test/integration/usecases/itemEditing/cronDeleteItemEditing/ --maxWorkers=1
npm run test:run -- src/services/itemEditing/test/createItem.test.ts src/services/itemEditing/test/createItemEditingDraft.test.ts src/services/itemEditing/test/createItemEditingCopy.test.ts src/usecases/items/create/test/createItem.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

maxWorkers=1は共有DBの期限選択テストを他ファイルと並列に走らせないため（ケース内の実競合は別途実行）。
通常lint対象外のtest配下TSは既存typescript-eslintのrecommendedを一時configで適用する。
全必須ケース・静的検査成功、cleanup/close完了、未決定事項なしを完了条件とする。
