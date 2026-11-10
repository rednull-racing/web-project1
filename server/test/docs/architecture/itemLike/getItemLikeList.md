# getItemLikeList テスト設計

設計日: 2026-11-10。パスはserver/基準。
根拠: [詳細設計](../../../../../docs/design/backend/detail/itemLike/getitemLikeList.md)と同日のユーザー回答5点。
目的は本人のいいね一覧の公開契約・検索・順序・一覧と件数の整合性を保証すること。
出品者で絞らず、ItemLike.user_idで本人限定。ItemLike.createdAt/id降順で`itemList:[{item:...}]`を返す。
uploaded_at・seller_id・search_text・関連idは公開しない。更新・通知・S3・フロント・既存一覧置換は対象外。

## 配置と検証境界

| レベル         | 配置                                                             | 実処理とモック                                                                |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| validator単体  | src/validators/query/test/getItemLikeList.test.ts                | 実Zod。接続なし                                                               |
| controller単体 | src/controllers/itemLike/test/getItemLikeList.test.ts            | 実controller、対象/対象外usecaseはモック                                      |
| usecase単体    | src/usecases/itemLike/test/getItemLikeList.test.ts               | 実正規化・変換、service/transactionはモック                                   |
| service単体    | src/services/itemLike/test/getItemLikeList.test.ts               | 実service、Model/query境界をモック                                            |
| HTTP           | test/integration/usecases/itemLike/getItemLikeList/route.test.ts | 最小Express、実parser/認証/制限/schema/controller/errorHandler、usecaseモック |
| 登録           | 同ディレクトリregistration.test.ts                               | 実registerRoutes/対象Router、認証・対象usecase・対象外Routerはモック          |
| 実DB           | 同ディレクトリdatabase.test.ts                                   | 実usecase/service/Model、実処理前後にspyでgate/障害注入                       |

fixtureはtest/fixtures/itemLike/getItemLikeList/に置く。httpMocks.tsは対象外usecaseのみ遮断する。
単体fixtureは対象test近くに置き、接続setupを読み込まない。
実DBはdatabaseSetup.tsでDB import前に.env.test由来/PostgreSQL/test_dbを検査し、databaseFixtures.tsで
アプリ・models・observerの全接続の実DB名・列/型/NULL/FKを検査してからseedする。
ユーザー2人・21件の商品/いいね・他人のいいね・未いいね・seller_id他人/null・関連あり/欠落を用いる。
ItemLike.user_idはNOT NULL、Item.statusはactive/soldoutのみのためnull所有者や未知statusの保存は作らない。
自作IDをhookで追跡し、全処理回収後にFK順で限定削除・残存0件・全接続close・env/spy復元を確認する。
スキーマ不一致はmigration/syncで補正しない。

## ケースと期待結果

すべて基本契約を扱うP0。V/C/U/Sは各層の単体、HはHTTP/登録、Dは実DB。
同じIDの入力違いはit.eachで展開する。詳細条件はテスト名から追跡する。

| ID          | 条件・手順                                                                 | 期待結果                                                                                |
| ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| V01         | page省略・1/10000・0/10001・小数・空・配列・object・非文字列               | 既定1/許可整数へ変換、不正は拒否                                                        |
| V03         | status active/soldout/未知/null/配列/object                                | 許可値のみ採用、その他undefined                                                         |
| V02         | keyword省略/null/文字列null/空/空白/長文/型違い、偽装キー                  | trim/検索なし、配列等拒否、未知キー除去、元入力不変                                     |
| C01         | raw queryの偽装値と異なる認証ID/検証済みquery                              | 検証済み項目だけusecaseへ。200と公開itemList/totalPagesだけ返す                         |
| C02         | usecase・送信失敗                                                          | 元例外next、失敗時に成功応答/再実行なし                                                 |
| C03         | usecase成功/失敗を保留                                                     | 保留中応答なし、解放後のみ応答/next                                                     |
| U01         | 正規化/ILIKE文字エスケープ、status分岐、page境界                           | seller条件なしのwhere/limit20/offset、RR/readOnlyと同一transaction/whereの引渡し        |
| U04         | 公開列/関連あり・null、件数0/20/21・範囲外                                 | 余剰項目非公開、順序を維持して{item}へ変換、ceil(count/20)                              |
| U02         | readOnly/list/count/transaction開始・完了の失敗                            | 元例外伝播、後続未実行、成功なし                                                        |
| U03         | 各service/外側transactionを保留                                            | 後続・成功返却は完了を待つ                                                              |
| S01         | 本人一覧・Item条件・関連・順序・ページング                                 | ItemLike.user_id固定、Item INNER JOIN、関連LEFT JOIN、createdAt/id降順、同一transaction |
| S01         | countとwhere引渡し                                                         | 同じ本人/Item条件、ページング/関連Video/Saleなし                                        |
| S02         | READ ONLY SQL                                                              | 同じtransactionで固定SQL、解決後undefined                                               |
| S03         | 空一覧・件数0                                                              | 取得結果をそのまま返す                                                                  |
| S04         | 各DB依存reject                                                             | 元例外伝播                                                                              |
| H01/H07     | query偽装・既定・両status・無効status                                      | 認証IDと検証済み値のみ採用、200                                                         |
| H02/H03     | page/keyword型不正、認証なし/不正/期限切れ＋不正page                       | 400/401の公開応答、認証優先、usecase未実行                                              |
| H04         | 内部例外                                                                   | 固定500、内部情報非公開                                                                 |
| H05/H11/H12 | 50/51回・別本人・窓59999/60000/60001・IP/token偽装                         | 本人単位の専用枠、429既定本文/RateLimit/Retry-After、窓終了で再開                       |
| H06         | 未認証/不正JSONを51回、400と500を25回ずつ                                  | 前者非計上、後者計上し次回429、parser優先                                               |
| H08         | 公開JSON例・関連null                                                       | JSONの形と全項目を完全一致                                                              |
| H09         | 実registerRoutes経由                                                       | /api/item-like/item-listへ到達                                                          |
| H10         | usecase成功/失敗を保留                                                     | HTTP応答は完了まで待つ                                                                  |
| D01         | 21件・他人いいね/未いいね/出品者他人/null・検索・status・1/2/3ページ・再送 | 本人一致のみ、20/1/0件・総2ページ、無一致0、非対象含め全自作行不変                      |
| D02         | 20件・Video/Saleあり/欠落・nullable列                                      | 全公開項目とnull保持、1ページ、範囲外でも総1ページ                                      |
| D03         | %/\_/バックスラッシュ/\*/正規表現文字の検索                                | search_textの通常文字として検索、nameだけ一致は除外                                     |
| D04         | service直接・異なるseller条件                                              | 本人のいいね条件維持、出品者の所有権を追加しない                                        |
| D05         | 実一覧SELECT後、別接続でいいね削除commit                                   | RR/readOnlyの実設定・別PIDを確認、当該countは旧snapshot、次要求で削除反映               |
| D06         | READ ONLY内で実UPDATE                                                      | SQLSTATE25006、count未実行、自作全行不変、再試行成功                                    |
| D07         | 商品順と異なるいいねcreatedAt・同時刻ID                                    | 商品日時/IDに依存せずいいね日時/ID降順                                                  |

更新APIでないため更新状態遷移・書込みrollback・通知/S3送信は対象外。
実COMMIT通信断・HTTP送信失敗時のDB復元は保証しない。snapshotは要求間で共有せず行ロックを保証しない。

## 実行と完了条件

server/で対象4単体ファイルと結合ディレクトリを明示して`npm run test:run -- <対象パス> --maxWorkers=1`。
DB fixture/hook干渉を抑えるため1 workerを使う。ケース内の別接続競合は実行する。
`npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`を実行。
通常lint対象外のtest/\*_/_.tsは既存typescript-eslint設定で追加検査する。
設計ケース全成功・必須未実行/skipなし・静的検査成功・cleanup/close完了で完了。
結果と修正履歴は[レポート](../../report/itemLike/getItemLikeList.md)へ記録する。
