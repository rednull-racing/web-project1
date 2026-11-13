# 出品した商品一覧 テストレポート

2026-11-13。[設計書](../../architecture/item-list/uploaded.md)に対応。
最新: 単体8件・結合8件成功、静的検査成功。E2E代表1件はsetup失敗で業務assert未到達。
E2E残り2ケースと他ブラウザーは前提失敗による未実行。O01/O02は人間確認待ち。
設計・テスト実装・実行結果記録を実施。本番コード・DB構造は変更していない。全体検証完了ではない。

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
