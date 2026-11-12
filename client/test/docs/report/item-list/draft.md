# 下書き商品一覧 テストレポート

実行日：2026-11-12。対象は `/item-list/draft`。[設計書](../../architecture/item-list/draft.md)に基づく単体・結合・E2Eを実装する。本文のパスは原則client基準、E2Eはリポジトリルートのtest基準。

## 最新結果

単体5ファイル43件成功。結合4ファイル15件のうち13件成功・2件失敗（C-A01）。E2Eは7 ID・8テスト実装・収集済み、起点E-N01のfixtureがDBスキーマガードで停止し本体未実行、残7テストは環境前提未成立で保留。未実装IDなし。人間観測3件は未実行。本番修正は行っていない。

## 検証境界

単体は対象本体を実行して依存を置換、結合は実SWR・実コンポーネント・共通fetchとMSWを使用する。平坦fixtureによるUI連携成功は、wrapped配列を返す実APIとの互換性を保証しない。削除パスは修正後の `/item-draft/:id` を検証する。本番コード・依存・共有設定・migrationは変更しない。

人間担当のO01～O03は未実行・人間確認待ち。ブラウザーの目視、実遷移の操作感、レスポンシブ、IME・フォーカスの見え方を自動成功に含めない。カバレッジ未取得。単体・結合・統合静的検査は指定Node.js26.12.1で確認。E2E起点の環境確認はNode.js22.22.2で行った。

## 修正案

### F1：一覧レスポンスとUI型・参照構造の不一致

根拠はC-A01および `server/src/usecases/itemDraft/getItemDraftList.ts`（リポジトリルート基準）。APIは `{itemDraft: row}[]`、画面は `ItemDraft[]` を期待して直接price等へアクセスする。共通fetcherは変換を行わない。修正案はAPI契約を維持し、画面境界でラップ解除・数値ID・nullable列・ISO日時に対応する型と表示方針を揃えること。型アサーションだけで隠さず、null価格を0円と表示するか未入力と表示するかを確定する。修正後はC-A01と実E-N01を再確認する。既存Todo `docs/todo/P1-bug/align-item-list-response-with-client.md` と同じ論点。提案のみ、本番修正なし。

### F2：既存の全体静的診断

全体lintの既存23 errors・34 warningsは対象外のref参照、effect内setState、宣言前参照、any等。本番型検査は既存ページの同期params/searchParamsとNext生成型との不一致、およびupload/okのItem.seller_id不存在。ページの入力契約・返却型と実装を照合して個別に修正する。ルール無効化や共有設定変更で通さない。今回は対象外として修正なし。

### F3：E2EテストDBのスキーマ不足（環境停止）

E-N01起点は `E2E_ENV_STOP: test_db connection/schema verification failed; no seed performed`。sandbox内では接続EPERM、権限を変えたread-only確認はtest_dbへ接続成功したが、既存DBガードがitem_draftの必須列不足を検出した。seed・migration・DB変更は行っていない。モデルとDBのカラムを管理手順で整合した後、E-N01を再開し、成功した場合に依存する検索・削除・認可の後続を再実行する。自動migrationやガード無効化は行わない。未認証E-S01も認証済み部分と共通fixtureを必要とするため今回は保留。

## 実行コマンド・根拠

client/でNode26.12.1のbinをPATH先頭にして以下を実行：

```bash
npm run test:unit -- src/app/item-list/draft/test/ src/app/item-list/draft/api/test/ --reporter=json --outputFile=/tmp/draft-final-unit.json
npm run test:integration -- test/integration/components/item-list/draft/ test/integration/pages/item-list/draft/ --reporter=json --outputFile=/tmp/draft-final-integration.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint src/app/item-list/draft/test src/app/item-list/draft/api/test test/fixtures/item-list/draft test/integration/components/item-list/draft test/integration/pages/item-list/draft
```

全体lintは23 errors/34 warnings（`/tmp/draft-final-lint.log`）、本番型検査は既存診断で失敗（`/tmp/draft-final-types.log`）。対象eslintとテスト型検査は成功（`/tmp/draft-final-target-lint.log`、`/tmp/draft-final-test-types.log`）。本番tsconfigもsrc内テストを含み、テスト用は結合と設定類も含む。対象診断0と全体成功は区別する。

test/でE2E先行実行（Node22.22.2、同じコマンドを権限を変えて再実行）：

```bash
ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4311/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4312/api npm run test:e2e -- E2E/item-list/draft/ --project e2e-chromium --grep E-N01 --reporter=list
```

ログは `/tmp/draft-e2e-run.log`、`/tmp/draft-e2e-run-escalated.log`。runnerは1 failedだがfixture停止であり業務assert失敗とは扱わない。後続は繰り返さず保留。収集8件、test/の型検査は成功（統合後Node26、`/tmp/draft-final-e2e-types.log`）。E2E TSの追加eslintはclientの設定を明示して担当worktreeで実行し成功（`/tmp/draft-e2e-lint.log`、設定由来noticeのみ）。

## ファイル別・設計ID別結果

以下は統合時JSONのassertionResultsから集計。describe数や再実行を加算しない。JSONと/tmpログは一時成果物であり、重要な結果は本書に記録する。

| ファイル（client基準） | 実行 | 成功 | 失敗 |
| --- | --- | --- | --- |
| `src/app/item-list/draft/test/draftItem.test.tsx` | 3 | 3 | 0 |
| `src/app/item-list/draft/test/draftItemList.test.tsx` | 13 | 13 | 0 |
| `src/app/item-list/draft/test/page.test.tsx` | 1 | 1 | 0 |
| `src/app/item-list/draft/test/removeFloat.test.tsx` | 8 | 8 | 0 |
| `src/app/item-list/draft/api/test/client.test.ts` | 18 | 18 | 0 |
| `test/integration/pages/item-list/draft/page.test.tsx` | 2 | 2 | 0 |
| `test/integration/components/item-list/draft/draftItemList/contract.test.tsx` | 2 | 0 | 2 |
| `test/integration/components/item-list/draft/draftItemList/integration.test.tsx` | 4 | 4 | 0 |
| `test/integration/components/item-list/draft/removeFloat/integration.test.tsx` | 7 | 7 | 0 |

| 設計ID | 実装テスト数 | 判定 |
| --- | --- | --- |
| C-A01 | 2 | 成功0・失敗2 |
| C-A02 | 1 | 成功1・失敗0 |
| C-E01 | 3 | 成功3・失敗0 |
| C-E02 | 3 | 成功3・失敗0 |
| C-E03 | 1 | 成功1・失敗0 |
| C-N01 | 1 | 成功1・失敗0 |
| C-N02 | 1 | 成功1・失敗0 |
| C-N03 | 1 | 成功1・失敗0 |
| C-X01 | 1 | 成功1・失敗0 |
| P-N01 | 1 | 成功1・失敗0 |
| P-N02 | 1 | 成功1・失敗0 |
| U-A01 | 10 | 成功10・失敗0 |
| U-A02 | 6 | 成功6・失敗0 |
| U-A03 | 2 | 成功2・失敗0 |
| U-D01 | 1 | 成功1・失敗0 |
| U-D02 | 1 | 成功1・失敗0 |
| U-D03 | 3 | 成功3・失敗0 |
| U-D04 | 2 | 成功2・失敗0 |
| U-I01 | 1 | 成功1・失敗0 |
| U-I02 | 2 | 成功2・失敗0 |
| U-L01 | 5 | 成功5・失敗0 |
| U-L02 | 1 | 成功1・失敗0 |
| U-L03 | 2 | 成功2・失敗0 |
| U-L04 | 3 | 成功3・失敗0 |
| U-L05 | 2 | 成功2・失敗0 |
| U-M01 | 1 | 成功1・失敗0 |
| U-X01 | 1 | 成功1・失敗0 |

E-N01は実装済み・fixture中断、本体未実行。E-N02/E-D01/E-D02/E-S01/E-S02/E-S03は実装済み・未実行保留（E-S03は他人/不存在の2テスト）。O01～03は人間確認待ち。これらをVitestのskip件数へ混ぜない。

C-A01の2条件はwrapped配列のままDraftItemへ渡されcreatedAtがundefined、formatRelativeTimeのgetTimeで描画例外となる。ErrorBoundaryで回収し、正常なLinkを期待するassertを通常の失敗として残した。商品名・価格・nullable補完の後続assertは未到達。失敗例外を期待するテストへ変更していない。C-A02は正規DELETEのURL・bodyなしと再取得をC-N03と同じテストで確認した（件数重複加算なし）。

U-X01/C-X01は現行挙動の観測成功であり、重複送信防止やページ自動補正が実装されたことを示さない。U-L04は設計のpage2に対してpage3からresetを確認し同じ分岐を通す。API helperの検索語undefinedは型契約外なので空文字を検索なしの代表とした。null価格の表示方針は未確定のまま。P-N01は実Container/TitleAndBackと一覧を接続するが、barrelの無関係部品は置換。async Pageの包含はU-M01でReact要素を検査し、実Nextレンダリングは未確認。

単体初期のモック型互換、結合初期のhoisted export・routerモック・role取得不備はテストだけ修正し解消。最終集計へ過去件数を加算しない。実認証・DBの成功、画面全体の完了を単体や平坦fixture成功から推定しない。

実装E2Eファイルは `test/E2E/item-list/draft/{getItemDraftList,deleteItemDraft,authorization}/flow.spec.ts`、fixtureは `test/fixtures/item-list/draft/{backendHarness,harness}.ts`（リポジトリルート基準）。後者は既存詳細ページ用DBガードを再利用する。予定のdatabase.tsを重複作成せず再利用し、clientのsetupはJSXがあるためsetup.tsxとした。
