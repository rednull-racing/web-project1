# 在庫一覧 テスト設計

2026-11-13。対象 /item-list/stock。
パスは原則client/基準、E2Eはルートtest/基準。
[レポート](../../report/item-list/stock.md)へ実行結果・修正案を集約する。

## 対象と根拠

src/app/item-list/stock/AGENTS.md、同page.tsx・stockItemList.tsx・stockItem.tsx・api/client.ts、
../types.ts、types/itemAttributes.ts、ItemListUIと共通検索・価格・画像・ページ部品を根拠とする。
APIはルートserver/src/routes/items.tsのGET /items/list/stock、
services/items/query/list/userItemList.tsの実attributesと並び順を照合。
ユーザー指示によりF1の戻るボタン化・F2の取得失敗時の空案内表示を修正する。
API変更・DB構造変更・在庫編集機能の追加は対象外。
uploadedの空表示に関するユーザー指示をstock固有文言変更の許可へ拡張しない。

Pageは非同期Server Component、一覧取得はクライアントSWR。
入力値→確定keyword/page→getListUrl→fetcher(Bearer)→実HTTP
→{itemList:[{item}],totalPages}→行・Paginationの順。
フロントはstatus/limitを送らない。バックエンドが本人のactive/soldoutを20件ずつ
uploaded_at DESC,id DESCで返す。検索の正規化・記号escapeはAPIが担当。
在庫はattributes.inventory.currentを表示し、色/サイズから再集計しない。
未取得中は空案内なし。取得失敗または空配列では「商品が見つかりません」。取得失敗時は一覧を非表示にする。
在庫の負数禁止など新しい入力契約は本作業で定めない。

## 階層・配置・fixture・保証

| 階層               | 配置                                                                  | 境界                                                |
| ------------------ | --------------------------------------------------------------------- | --------------------------------------------------- |
| 単体               | src/app/item-list/stock/api/test/client.test.ts                       | URL実物、環境変数のみ固定                           |
| 単体               | src/app/item-list/stock/test/stockItem.test.tsx                       | 商品行/価格/画像実物、HTTPなし                      |
| コンポーネント結合 | test/integration/components/item-list/stock/list/integration.test.tsx | 一覧/SWR/fetcher/子部品実物、MSW実ルート・固定token |
| ページDOM結合      | test/integration/pages/item-list/stock/page.test.tsx                  | ItemListUI・一覧実物、router.back spy               |
| E2E                | test/E2E/item-list/stock/getStockItemList/flow.spec.ts                | NextAuth/Express/隔離test_db実物、業務APIモックなし |

fixture: test/fixtures/item-list/stock/{fixtures.ts,setup.tsx}。
数値ID101、name/Videoあり、価格文字列1200、画像null、Sale null、
ISO日時、attributes.inventory={initial:2000,current:1234,low_stock_ratio:0.2}。
wrapped構造を保ち暗黙変換しない。ケースごとの変更点は下表。
SWR Mapはケースごと分離、focus/reconnect/retry停止。共通setupでDOM/MSWを後片付け。
遅延はPromise gateで制御。未定義通信を成功handlerで隠さない。
DOM結合は非同期Pageを直接呼ばず同じ組立を使う。
実Page・実ルーティング/認証接続はE2Eへ分担し、metadata/SSR内部整合性は未保証。
共通部品の全分岐は既存item-list/\_components設計・テストへ委ねる。

## ケース

U=単体、I=コンポーネント結合、P=ページDOM結合、E=E2E。
N正常、V境界、A競合/認可、E障害。優先度とIDは独立。

| ID/優先度 | 入力・操作                                   | 期待・停止位置                                                                                             |
| --------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| U-N01/P0  | page1空、page2空白、page3日本語&%            | trim/encode済みURL、keyword省略、status追加なし。3展開                                                     |
| U-V01/P0  | current=0/1/1234、soldout、色別在庫99        | 在庫0含む桁区切り、99を集計しない、SOLDなし、詳細href、mutate未呼出し。3展開                               |
| U-V02/P0  | attributes省略/空、name/Video/image/日時null | クラッシュなし、在庫ラベルのみ、空見出し、代替画像、価格文字列の桁区切り。2展開                            |
| U-N02/P1  | Sale文字列2000/40、discount_amount null      | 変更前価格・40% OFF・動画タイトル                                                                          |
| I-N01/P0  | 標準wire JSON                                | 在庫1234と詳細リンク、page1/statusなし/Bearer、wrapped接続                                                 |
| I-N02/P0  | page2→入力→Enter→clear                       | page1へ、未確定keywordなし、確定後反映、clear解除                                                          |
| I-N03/P1  | 検索アイコン→0件                             | 検索確定・空案内・ページボタンなし                                                                         |
| I-A01/P0  | 旧検索保留→新検索完了→旧解除                 | 新結果維持、旧結果非表示                                                                                   |
| I-E01/P1  | HTTP500→unmount→正常mount                    | 空配列と同じ案内、商品非表示、再取得復帰                                                                   |
| I-V01/P0  | 初回応答保留→0件                             | 未取得で空案内なし、応答後空案内、リンクなし                                                               |
| P-N01/P1  | 実ページ枠に一覧、戻る操作                   | 在庫一覧の見出し・検索・在庫表示、button/戻るの操作でback要求                                              |
| E-N01/P0  | 実ログイン、本人21/他人1/所有者null1、同日時 | 20+1のID降順、本人のみ、1234/0/attributes{}、実heading/link、SOLDなし、Video/Sale null・機密列なし、DB不変 |
| E-N02/P0  | %と不一致検索Enter、seller_id偽装API         | 実HTTP検索と0件表示、本人制約維持、DB不変                                                                  |
| E-A01/P0  | 未認証一覧GET                                | 401、商品情報非公開、DB不変                                                                                |

E2Eはtest/fixtures/item-list/stock/harness.ts（ルート基準）。
既存uploaded/draftの実環境基盤を利用、専用IDのみfinallyで後片付け。
同日時順序は検証するが異なる日時順序の網羅、Sale/Videoありの実DB関連表示は今回対象外。
関連表示は単体で保証。実認証・APIに失敗したら後続依存assert未到達として報告する。

## 人間観測

| ID  | 担当・前提                                                        | 手順・期待                                                                      | 状態         |
| --- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------ |
| O01 | 人間、3ブラウザー、359/768/1280px、ログイン、0/1234在庫とSale商品 | 在庫/価格/画像の切れや重なりなし、SOLD非表示、詳細→戻る、keyboard/focus追跡可能 | 人間確認待ち |
| O02 | 人間、遅延/500/0件環境                                            | 読込→正常/空/失敗の見え方・ちらつき・体感操作を記録                             | 人間確認待ち |

## 実行順と完了条件

Node/依存と実API契約→単体→代表I-N01→残り結合→E2E代表E-N01。
clientで対象test:unit/test:integration、npm run lint、npm run typecheck、
./node_modules/.bin/tsc --noEmit -p test/tsconfig.jsonを実行。
testでnpm run typecheck、E2E対象spec --project e2e-chromium --grep E-N01を先行し、
成功後全3ブラウザーへ展開。公開API URLはbuild時に4333 proxyへ固定、
Next3032/Express4332/proxy4333と認証設定を揃える（uploaded環境を再利用）。
HTTP Secure CookieによりWebKitの認証情報が利用できない場合は、
認証を弱めず原因を記録してHTTPS環境での再開を残す。
DB migration/sync・環境初期化は行わない。
前提失敗は反復せず独立ケースのみ継続。
自動完了と人間観測完了は別判定。ケースID・実assert・件数・未到達をレポートで照合する。
