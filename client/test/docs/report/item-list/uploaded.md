# 出品した商品一覧 テストレポート

## F1修正（2026-11-13、最新）

ユーザー指示により、取得失敗時も0件と同じ「商品が見つかりません」を表示する本番UIへ変更。
SWR errorがある場合は一覧・ページネーションを非表示にする。未取得中は案内なし。
API・認証・DBは未変更。過去のF1の専用エラー/retry UI提案と「出品した商品はありません。」指定は、今回の指示による表示契約で更新する。
I-E01の旧期待「HTTP500で空案内なし」を新仕様へ変更し、リンク非表示・正常再mountでの復帰確認は維持。
設計書とページAGENTSも更新した。

clientで実行:
- npm run test:integration -- test/integration/components/item-list/uploaded test/integration/pages/item-list/uploaded

Vitestの最終出力は2ファイル8件成功、失敗・skip0。
実SWR/一覧/共通UIを使用し、HTTPはMSW、認証tokenとNext routerはモック。
npm run lint・npm run typecheck・./node_modules/.bin/tsc --noEmit -p test/tsconfig.jsonはすべて成功。
単体・E2E・目視は今回未再実行。WebKitの既存2件失敗とO01/O02は継続残件。
以下の初回結果・過去の仕様指示は履歴。

## 過去の結果・実行履歴

2026-11-13。[設計書](../../architecture/item-list/uploaded.md)に対応。
最新: [E2E再実行](#e2e再実行2026-11-13)で全3ケース×3ブラウザーの9件を実行し、7件成功・2件失敗。
Chromium/Firefoxは各3件成功、WebKitは未認証1件成功・認証後の一覧2件失敗。
DBガード停止は解消。WebKitのHTTP環境とSecure Cookieの問題が残る。
単体8件・結合8件と人間観測は今回未再実行。以下の初回結果表は履歴。

## 実装・結果対応

パスはclient/基準、E2Eのみルート基準。

| 設計ID | テストファイル | 最新結果・assert範囲 |
| --- | --- | --- |
| U-N01/U-V01 | src/app/item-list/uploaded/api/test/client.test.ts | 4件成功、3tab URL・trim/encode・空検索・null key |
| U-N02/U-V02 | src/app/item-list/uploaded/test/uploadedItem.test.tsx | 4件成功、性別3展開・kids・リンク・価格文字列・nullable・画像fallback・SOLD・Sale |
| I-N01 | test/integration/components/item-list/uploaded/list/integration.test.tsx | 3件成功、wrapped JSON・page/status・実fetcher Bearer |
| I-N02/I-N03 | 同上 | 2件成功、ページ/検索確定・解除・アイコン・0件とpagination非表示 |
| I-A01/I-E01 | 同上 | 2件成功、遅い旧応答上書き防止・500時空案内なし・再mount復帰 |
| P-N01 | test/integration/pages/item-list/uploaded/page.test.tsx | 1件成功、実タブ/枠/一覧、3tab pushとback。非同期Page本体・実遷移は対象外 |
| E-N01 | test/E2E/item-list/uploaded/getUploadedItemList/flow.spec.ts | Chromium代表setup失敗、一覧GET・wire・所有権・20+1・DB不変のassertすべて未到達 |
| E-N02/E-A01 | 同上 | 実装済み未実行、status/検索/偽装/未認証契約は未保証 |
| O01/O02 | 設計書の人間観測表 | 人間確認待ち。全3ブラウザー・3画面幅・操作/フォーカス・非同期表示未確認 |

単体2ファイル8件、結合2ファイル8件。16件成功、失敗0・skip/pending0。
各ランナーJSONのassertionResultsから集計しdescribe件数を加算していない。
E2Eは別集計: 代表1件failed（setup）、残り2IDは未実行でskip件数に含めない。
カバレッジ未取得。単体/結合に未処理例外なし。

## 環境・再現方法・保証境界

Node v26.12.1、既存インストール済み依存を使用。新規依存追加なし。
clientで実行:
- npm run test:unit -- src/app/item-list/uploaded --reporter=json --outputFile=/tmp/uploaded-unit.json
- npm run test:integration -- test/integration/components/item-list/uploaded test/integration/pages/item-list/uploaded --reporter=json --outputFile=/tmp/uploaded-integration.json
- npm run lint
- npm run typecheck
- ./node_modules/.bin/tsc --noEmit -p test/tsconfig.json

上記静的検査は最終実行成功。通常lintが今回追加TSも対象とする。
E2E担当がtestでnpm run typecheckと追加ファイルの既存ESLint設定によるlintを実施、成功。
一時JSONと/tmp/uploaded-{lint,type,test-type}.logは一時証拠で、恒久成果物ではない。
本番型検査とテスト型検査は別々に実施した。

HTTPは実ルートをMSWで置換、実SWR/共通fetcher/検索/子部品を使用。
結合テストの認証は固定token取得のみで、実認可保証ではない。
fixtureとcache分離はtest/fixtures/item-list/uploaded配下。画像の実ロード・SSR/Hydrationは未保証。
E2Eは実NextAuth/Express/test_dbを接続する設計だが、今回はDB guardまでで停止。

## 実行履歴・失敗と修正案

### F1: エラー表示契約の不足（提案のみ、I-E01）

HTTP500で一覧も空案内も表示されない。専用loading/error表示・retry UIは現行実装にない。
I-E01は現行挙動と再mountの復帰を観測するテストであり、望ましいエラーUXの成功保証ではない。
上位client規則は読込/失敗/空を区別する方針を示すが、表示文言と再試行方法は未確定。
修正案: SWR error/isLoadingの表示とretry操作を仕様確定後に設計し、失敗時の案内・再取得・成功復帰を追加検証する。
表示契約が変わるため本番コードは未修正。現在の16件成功で解消扱いにしない。

### F2: E2E前提のschema guard停止（未解消、E-N01/E-N02/E-A01）

担当の代表コマンドはE2E README記載の環境変数付きコマンドに --reporter=list を追加。
sandbox内、承認後の再実行とも代表E-N01が
「test_db schema verification failed」でsetup停止。接続のみの切分けはDB_CONNECT_OK。
既存draft backendHarnessが利用するitem_draft/item_editingのschema guardと現在DBの不一致。
個別の列差分は未特定。seed未実施、業務GET・DOM・DB不変assert未到達。
接続不可と混同せず、共有ハーネスのガードを削除・緩和していない。
修正案: 管理者が対象DBと承認済みスキーマを照合し、必要なDB整備を別作業で実施する。
あるいはuploaded専用schema検証・最小seedハーネスへ責務を分離する場合は別途設計する。
復旧後はbuild時公開API URL・NextAuthのAPI_URL・proxy・Next起動をREADMEどおり一致させ、
代表成功後にE-N02/E-A01とFirefox/WebKitへ進む。migration/syncは実行していない。

### F3: テスト実装の初回不備（修正・再検証済み）

初回単体7成功/1失敗。Next Imageが最適化URLを生成するため、
fallbackのsrc直値比較が不適切だった。旧期待値は/no-image(1x1).pngとの完全一致。
decodeしたURLが同画像を参照するassertへ修正し、元のfallback保証を維持した。
初回結合は4成功/3失敗。fixtureモジュール内mockだけではtoken境界が置換されず、
Authorizationがnullだった。対象テスト直下にvi.mockを置き、Bearer assertを維持した。
型検査ではgetByRoleの非対応exactオプションを検出し、文字列nameの完全一致へ修正。
最終単体8/8、結合（ページ追加後）8/8、型検査・lint成功。未処理例外なし。
これらはテスト不備であり、本番の認証不具合として報告しない。

## 残件・判定

自動実装は全予定階層に作成。E2Eの実認証・API/DB整合性は未確認。
P-N01は実PageのsearchParams既定値やmetadataを検証していない。実Nextの確認はE2E再開時に補う。
人間は設計書O01/O02の前提・手順で確認し、本書へ結果を追記する。
F1は仕様判断、F2は環境復旧が必要。未確認項目を成功とみなしていない。


## F2再検証（2026-11-13）

今回の対象は共有E2E fixture test/fixtures/item/itemDraftPage/database.ts。
本番・DB・migrationは変更していない。

- item_editing.seller_idのON DELETE期待値を旧NO ACTIONからモデル定義のSET NULLへ修正。
- item_draftにはないbefore_price/discount_rate/discount_amount/sale_flagを、
  同テーブルの必須列・型・nullable検証およびseedから除外。item_editingの検証・seedは維持。
- エラーを一律に隠していたcatchを修正。既知の検証メッセージだけを許可し、
  接続先・認証情報など任意の依存エラー内容は出力しない。

代表E-N01をREADMEと同じコマンド（--reporter=list追加）で段階的に再検証。
1. FK期待値のみ修正後: schema mismatch item_draftでsetup停止。
2. 下書きセール列修正後: foreign key mismatch item_editing.seller_idでsetup停止。
最終ランナー結果は1 failed（setup）、業務assert未到達・seed未実施。
後続E-N02/E-A01と他ブラウザーは共通前提失敗で保留。再試行を成功件数へ合算しない。

実DBを読み取り照合した結果:
item_editing_seller_id_fkeyは参照先user、ON UPDATE NO ACTION、ON DELETE NO ACTION。
モデルはON DELETE SET NULLであり、この点の不一致は実在する。
したがって初回停止はテストの存在しない下書き列条件が原因だったが、
それを除いた現在は実DBの外部キー条件で停止している。
旧レポートの「個別差分未特定」は初回時点の記録。

修正済みテスト条件を再び緩めず、DBを唯一の正とする方針に従い、
どちらの削除動作を正式契約とするか確認してからモデル/DB/テストを整合する。
DB変更は今回の依頼に含まないため未実施。

testでnpm run typecheck成功、git diff --check成功。
client ESLintから対象指定した試行はoutside of base pathで対象外となり、lint成功とは扱わない。
単体・結合・client全体の静的検査は今回未再実行。

F1の更新: ユーザーはエラー専用表示・retry UI追加を不要とし、
0件時は一律「出品した商品はありません。」を表示する仕様を指定した。
旧F1の追加UI提案は取り下げ。本番表示と既存テストの変更は今回のF2修正対象外。


## F2 外部キー変更の適用（2026-11-13）

ユーザー指定によりitem_draft.seller_id・item_editing.seller_idをSET NULLへ変更。
20261113090000-set-null-draft-editing-seller.jsを--name指定し、
development（実DB neondb）・test（test_db）の両方に適用済み。
各DBのpg_constraintとSequelizeMetaを読み取り、両FKの参照先user、
ON DELETE SET NULL、ON UPDATE NO ACTION、適用履歴1件を確認した。
モデル2ファイルと共有E2Eガードも両seller_idのSET NULLへ整合した。
up/downは各DB内でトランザクション実行し、downはNO ACTIONへ戻す。
他の未適用migrationは実行していない。server lint・typecheck成功。

訂正: 過去の説明でitem_editing.seller_idのモデルがSET NULLとしたのは誤読。
SET NULLだったのはitem_idであり、seller_idモデルも変更前はNO ACTIONだった。
今回の明示指示で初めて両seller_idモデルとDBをSET NULLへ変更した。
F2の外部キー停止条件はDB上で解消済み。E2E本体は今回未再実行で、
Next/API起動・実認証からの代表再検証は引き続き必要。

## E2E再実行（2026-11-13）

### 最新集計

集計元はPlaywright JSON /tmp/uploaded-e2e-final.json（一時成果物）。
3設計ID×3ブラウザー=9件。7 passed、2 failed、skip0、retry0。
事前の代表単独実行は合算しない。未処理例外として独立したランナーエラーなし。
失敗ケース内の例外は以下に記録。全件成功ではない。

| project | E-N01 | E-N02 | E-A01 |
| --- | --- | --- | --- |
| Chromium | 成功 | 成功 | 成功 |
| Firefox | 成功 | 成功 | 成功 |
| WebKit | HTTP401で失敗 | itemList未定義のmapで失敗 | 成功 |

成功範囲: 実NextAuth、実Express itemsルート、test_db、本人21件の20+1ページ、
同日時ID降順・他人/所有者null除外、nullable Video/Sale、画面リンク、
selling/soldの実HTTP条件、%検索・0件・seller_id偽装、未認証401とDB不変。
人間の見た目・操作感・フォーカスの確認は行っていない。

### 準備・コマンド・途中経過

1. DB修復後の代表実行はガード・seedを通過し、既存Nextの実ログインで失敗。
2. clientで NEXT_PUBLIC_API_URL=http://127.0.0.1:4333/api npm run build を実行し成功。
   専用Nextを127.0.0.1:3032で起動。API_URLは上記proxy、
   NEXTAUTH_URLは同Next URL、secretはserver/.env.testの値を非表示で読込。
3. 実ログイン成功後、一覧応答待機が30秒でtimeout。traceのconsoleで
   CORS preflightにAccess-Control-Allow-Originがないことを確認。
4. test/fixtures/item-list/draft/backendHarness.tsのproxyがOrigin/preflight要求ヘッダーと
   CORS応答ヘッダーを転送していなかったため修正。API応答は実物のまま、
   本番CORS設定や認証・Cookie設定は変更していない。
5. Chromium代表E-N01成功後、以下の全体実行を実施。

実行場所test/:
```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3032 ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4332/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4333/api PLAYWRIGHT_JSON_OUTPUT_FILE=/tmp/uploaded-e2e-final.json npm run test:e2e -- E2E/item-list/uploaded/getUploadedItemList/flow.spec.ts --reporter=list,json
```

Nextは検証終了後停止。fixtureのfinallyでテストデータとExpress/proxyを後片付け。
testでnpm run typecheck成功。変更したbackendHarness.tsは既存server依存の
ESLint/TypeScript ESLint recommended設定をAPIから適用し診断0。
client本番コード未変更のため単体/結合・client全体静的検査は再実行していない。
git diff --check成功。カバレッジ未取得。

### F4: テストproxyのCORS転送不足（修正・検証済み）

業務HTTPを置換せずCORS関連ヘッダーを双方向転送する修正。
Chromium代表成功と上記全体実行で通信成立を確認。
元のtimeout期待や認証assertは緩めていない。

### F5: WebKitのHTTP/Secure Cookie環境（未解消）

E-N01: ログイン後の一覧GETが401（期待200）。
E-N02: 同じ認証不足の応答にitemListがなくmapがTypeError。
タブ結果・後続の検索/偽装・DB不変assertは未到達。
traceでWebKitの一覧GETにAuthorizationがないことを確認。
ページ応答はaccess-tokenにPath=/; Secure; SameSite=laxを設定している。
本番モードのmiddlewareはSecureを付け、getAccessTokenはdocument.cookieから読む。
HTTPのローカル環境でWebKitが同Cookieを利用できていないと推定する。
Chromium/Firefoxの成功をWebKit成功へ読み替えない。

修正案・再開条件: 信頼済みローカル証明書を使うHTTPSのNext/API proxyを準備し、
URL・CORS・NextAuthを揃えてWebKitの2ケースを再実行する。
既存ハーネスはHTTP loopbackを前提とするためHTTPS対応には別途環境整備が必要。
認証モック・Cookie手動注入・本番Secure無効化は行っていない。
E-N02にはHTTP200を確認してからJSONを読むassertを追加する余地があるが、
今回の実測は上記のTypeErrorとして保持する。
