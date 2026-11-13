# 在庫一覧 テストレポート

## F1・F2修正（2026-11-13、最新）

ユーザー指示により本番UIを修正。以下の初回結果・本番未変更の記述は履歴。
F1: 共通TitleAndBackをtype=button・aria-label=戻るのボタンに変更。
既存backButton CSSを利用し、アイコンとrouter.back/pushの処理を維持。
P-N01をSVG属性取得からbutton/戻る取得へ変更した。
F2: stockのSWR errorを参照し、失敗時も空配列と同じ「商品が見つかりません」を表示。
失敗時は一覧とpaginationを非表示にし、初回読込中の空案内は表示しない。
旧I-E01の「失敗時に案内なし」は今回の明示仕様に合わせて期待値を変更した。
API・認証・DBは未変更。uploadedは今回の修正対象外。

clientで実行:
- npm run test:integration -- test/integration/components/item-list/stock test/integration/pages/item-list/stock test/integration/pages/item-list/draft test/integration/pages/item-list/trash

Vitestの最終出力で4ファイル12件成功、失敗・skip0。stock7件、draft/trashページ回帰5件。
実SWR/一覧/共通UIを使用、HTTPはMSW、認証tokenとNext routerはモック。
npm run lint・npm run typecheck・./node_modules/.bin/tsc --noEmit -p test/tsconfig.jsonはすべて成功。
E2E・単体・目視は今回未再実行。F3のWebKit環境問題とO01/O02は残件。

## 初回結果・実行履歴

2026-11-13。[設計書](../../architecture/item-list/stock.md)に対応。
単体9件・コンポーネント結合6件・ページDOM結合1件成功。
E2Eは9件中7件成功・2件失敗。Chromium/Firefox各3件成功、WebKit認証後2件401・未認証1件成功。人間観測O01/O02は未確認。
本番コード・共有設定・DB構造の変更なし。新規依存なし。

## ケース対応と保証範囲

パスはclient/基準、E2Eはルートtest/基準。

| ID | 実装 | 結果・確認内容 |
| --- | --- | --- |
| U-N01 | src/app/item-list/stock/api/test/client.test.ts | 3展開成功。page・空/空白・trim/日本語&%encode、statusなし |
| U-V01 | src/app/item-list/stock/test/stockItem.test.tsx | 3展開成功。在庫0/1/1234、桁区切り、色別在庫非集計、SOLDなし、href、mutate未呼出し |
| U-V02 | 同上 | 2展開成功。attributes省略/空、nullable name/Video/image/日時、fallback画像と価格文字列 |
| U-N02 | 同上 | 1件成功。Sale文字列・null割引額・動画 |
| I-N01 | test/integration/components/item-list/stock/list/integration.test.tsx | 1件成功。wrapped JSON・在庫表示・実fetcher Bearer・page/status条件 |
| I-N02/I-N03 | 同上 | 2件成功。ページ2→入力で1、Enter確定・clear解除・アイコン検索・空応答 |
| I-A01 | 同上 | 1件成功。遅い旧応答を解除後も新検索のheadingを維持 |
| I-E01 | 同上 | 1件成功。HTTP500で空応答扱いしない現状、再mountで復帰 |
| I-V01 | 同上 | 1件成功。未取得中空案内なし、空配列後のみ案内・リンクなし |
| P-N01 | test/integration/pages/item-list/stock/page.test.tsx | 1件成功。実ページ枠/見出し/検索/在庫表示とrouter.back要求 |
| O01/O02 | 設計書の人間観測表 | 人間確認待ち。3browser×3画面幅、見た目・操作感・keyboard/focus・遅延時表示 |

単体2ファイル9件、結合2ファイル7件。成功16、失敗0、skip/pending0。
JSON assertionResultsに基づき、describe数や再実行を加算しない。
coverage未取得。単体・結合の未処理例外なし。
API/DB認可はMSWや固定tokenでは保証せずE2Eへ分担。
非同期Pageを直接呼ばないためmetadata・SSR/Hydration内部整合性は未確認。
色/サイズ別集計や在庫編集機能はない。型外のinventory.current欠落/不正型の許否を
今回のテストで新しい仕様として定めていない。

## 実行条件・コマンド

Node v26.12.1、既存依存。clientで以下を実行:
- npm run test:unit -- src/app/item-list/stock --reporter=json --outputFile=/tmp/stock-unit.json
- npm run test:integration -- test/integration/components/item-list/stock test/integration/pages/item-list/stock --reporter=json --outputFile=/tmp/stock-integration.json
- npm run lint
- npm run typecheck
- ./node_modules/.bin/tsc --noEmit -p test/tsconfig.json

fixtureはtest/fixtures/item-list/stock。実SWR/共通fetcher/行/検索/ページ部品、
MSWの実stockルート・固定tokenでHTTP境界を置換。
各ケースで独立Map、遅延Promiseとfinally解除、共通setupでcleanup。
実ブラウザー画像読み込み・layoutはこの階層で保証しない。
一時証拠は/tmp/stock-{unit,integration}.json、
/tmp/stock-{lint,type,test-type}.log。重要な結果は本文に保持。

## 初回失敗と修正案

### F1: ページテストのDOM取得方法（修正・検証済み、P-N01）

初回結合は5成功1失敗。TitleAndBackの戻る操作をrole=button/戻るで取得したが、
同部品はそのaccessible role/nameを持たず失敗。
既存下書きページの取得方法に合わせ[data-icon=angle-left]を取得して操作し、
router.backが1回呼ばれるassertを維持した。見出し・一覧・検索のassertは変更なし。
I-V01追加後の最終結合は7/7成功。本番UIは未変更。
キーボード・フォーカスの実観測はO01へ残す。

### F2: 専用ローディング/エラーUIなし（観測、I-E01/I-V01）

現行stockはHTTP500時も未取得時も一覧を表示せず、空配列だけ空案内を出す。
テスト成功はこの観測と再取得復帰を示す。
uploadedの空表示文言指示をstockへ自動適用せず、本番の表示を変更していない。
失敗表示や統一空案内が必要ならstock側の契約を確定したうえで設計・テストを更新する。
専用UI追加を今回の必須修正とは判定しない。


## E2E実接続結果

ファイル: test/E2E/item-list/stock/getStockItemList/flow.spec.ts、
fixture: test/fixtures/item-list/stock/harness.ts（ルート基準）。
集計元/tmp/stock-e2e-final.json（一時成果物）のstats:
expected7/unexpected2/skipped0/flaky0、duration約51.9秒。
3設計ID×3projectの9件。代表単独成功は合算しない。

| ケース | Chromium | Firefox | WebKit |
| --- | --- | --- | --- |
| E-N01 | 成功 | 成功 | 初回GET 401、期待200で失敗 |
| E-N02 | 成功 | 成功 | 初回GET 401、期待200で失敗 |
| E-A01 | 成功 | 成功 | 成功 |

E-N01成功では本人21件・他人/owner null除外、同日時ID DESCの20+1、
実Pageのheading、行hrefと商品名、価格と区別した在庫0/1,234、
空attributes、SOLD非表示、Video/Sale null、seller_id/search_text非公開、DB不変を確認。
E-N02成功では%通常文字と一致なしを実画面から検索しwire ID/totalPages/0件案内、
seller_id偽装要求の本人条件維持とDB不変を確認。
E-A01は401・商品名非公開・DB不変を全projectで確認。
商品行だけでなく既存共有fixtureの保護対象も不変確認し、finallyで専用IDを後片付けした。

### 実行環境と再現

前回uploadedでbuild成功済みの本番Nextを再利用（本番コード変更なし、
NEXT_PUBLIC_API_URL=http://127.0.0.1:4333/api固定）。
専用Next3032をAPI_URL=同proxy、NEXTAUTH_URL=http://127.0.0.1:3032、
NEXTAUTH_SECRETはserver/.env.testから値を表示せず取得して起動した。
Express4332/proxy4333は既存実ハーネスが起動する。
業務API・認証をモックせずtest_dbへ接続。DB migration/syncは実行していない。

testで代表:
```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3032 ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4332/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4333/api npm run test:e2e -- E2E/item-list/stock/getStockItemList/flow.spec.ts --project e2e-chromium --grep E-N01 --reporter=list
```
成功後、grep/projectを外して全3browser:
```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3032 ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4332/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4333/api PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/stock-e2e-final.json npm run test:e2e -- E2E/item-list/stock/getStockItemList/flow.spec.ts --reporter=list,json
```

test/npm run typecheck成功。追加E2E TS2ファイルは既存TypeScript ESLint recommendedで診断0。
client全体lint・本番型検査・テスト用型検査はすべて成功。対象外診断もなし。
git diff --check成功。テスト収集/setup失敗なし。未処理例外の独立エラーなし。
runnerのNO_COLOR/pg並行queryの警告は検証失敗件数へ加算しない。
検証後、専用Nextを停止した。

### F3: WebKit HTTP/Secure Cookie環境（提案のみ・残件）

WebKit E-N01/E-N02は実ログインを通過後、初回一覧HTTP200 assertで401失敗。
traceでstock requestのAuthorization不在を確認。
在庫・順序・検索・所有者偽装・DB不変など後続assertは未到達。
uploadedの同環境で確認したSecure CookieとHTTP環境の不整合と同じ原因と推定する。
本番認証・Secure設定を緩めず、信頼済み証明書を使うHTTPSのNext/API proxy環境へ
既存HTTP前提ハーネスも含めて整備し、WebKit2ケースを再実行する案を残す。
Cookie手動注入で成功扱いにしていない。
残る3browserの画面観測O01/O02は人間確認待ち。全階層完了/全成功ではない。
