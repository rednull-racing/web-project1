# itemDraftPage テストレポート

## 実GET接続の追加E2E（2026-10-29、今回の最新結果）

getItemDraftPage実装により実行可能になったF11の実GET取得込みE2Eを検証した。旧DB-backed GET代替をharnessから削除し、Next.js SSR→転送proxy→実Express Router/認証/usecase/service→test_dbを接続した。本番コード・DBスキーマは変更していない。以下の過去節の「実GET未実装・代替取得」は今回実行分には適用しない。B/U/C/Pは今回再実行していない。

追加 `test/E2E/item/itemDraftPage/getItemDraftPage/flow.spec.ts` はAF-GET01〜03を3ブラウザーで展開し、**9件すべて成功**。AF-GET01は公開列・数値ID・ISO updatedAt・Category親null/子配列・SSR商品表示・同一描画GET1回・DB不変、AF-GET02は他人の下書きの実404・商品名/操作非露出・DB不変、AF-GET03は未入力値null/空attributesの実取得とSSR表示を確認した。親子複数件等のDB取得網羅はbackend側の検証範囲であり、ここでは今回のseedに限定する。

実GETを通した既存代表フロー（E-N01上/下・E-N02・E-N04・E-N05編集/削除）18件も実行。Chromium/Firefoxは各6件成功。WebKitの既存操作不成立は残り、E-N01上/下・E-N02・E-N04は業務HTTP応答待ちでtimeout、E-N05編集/削除はupload/my-pageへの遷移待ちで失敗した。WebKitでも実GET/SSR追加3件は成功しており、取得APIの不成立とは区別する。今回の失敗ではcookie不存在を直接再検査しておらず、以前のcookie観測だけから原因を断定しない。失敗した操作後のDB/再訪assertは未到達。

| project | 成功 | 失敗 | timeout | skip |
| --- | ---: | ---: | ---: | ---: |
| e2e-chromium | 9 | 0 | 0 | 0 |
| e2e-firefox | 9 | 0 | 0 | 0 |
| e2e-webkit | 3 | 2 | 4 | 0 |

計27件：成功21、失敗2、timeout4。トップレベルerrors/flaky/interrupted/未着手0。3実ファイル別では取得9成功、編集8成功/1失敗/3timeout、削除4成功/1失敗/1timeout。先行のChromium追加3件成功は同じ最終27件に含まれるため重複加算しない。過去の383件全体を今回再検証した結果ではない。

### 実行と証拠

Node22.22.2。production buildはclient/で `NEXT_PUBLIC_API_URL=http://127.0.0.1:4021/api npm run build -- --webpack` を実行し成功。Nextの既存 `ignoreBuildErrors` 設定を維持しており、型検査成功とは別。起動はtest/で `node fixtures/item/itemDraftPage/startNext.mjs e2e`。SSRのAPI_URLは起動helperでloopback4022/api、ブラウザーの業務APIはbuild時4021/apiへ固定。実認証・各ケース別隔離Expressを使い、app全体のcron bootstrapは実行しない。

```bash
# test/、Node22のPATHを指定
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4021/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4022/api ./node_modules/.bin/playwright test E2E/item/itemDraftPage/ --grep 'AF-GET|E-N01|E-N02|E-N04|E-N05' --workers=1 --trace=off --reporter=json > /tmp/item-draft-real-get-final.json
```

20:19 JST開始、235.55秒、exit1（上記6件の既存WebKit失敗/timeout）。JSONの各project/file/title/resultから集計。先行3件は `/tmp/item-draft-real-get-chromium.json`、buildは `/tmp/item-draft-real-get-build.log`。JSON/ログ・test-resultsのerror-contextは一時成果物。Nextの初回起動はsandboxのlisten EPERMで停止し、承認付き同一コマンドで起動後に検証した。Nextは検証後停止、各ケースのExpress/全DB接続closeとfixture cleanupまで終了し、cleanup/teardownの追加失敗なし。

DB接続は既存基盤のserver/.env.test由来PostgreSQL test_dbを使用。fixture pg接続と隔離Expressの2 Sequelize接続を各々接続前のDB名・接続後current_databaseで確認し、既存schemaガードの通過後だけseed。自作ユーザーIDに属する生成行と追跡したfixture IDだけをcleanupし残存確認、全接続close。以前からのenum/全master型等のschemaガード不足は拡張していないため、その未実装まで解消したとはしない。実GET観測はpath/status/公開bodyのみで、認証情報を記録しない。

### 静的検査・残件

- test/ `npm run typecheck` とclient/ `./node_modules/.bin/tsc --noEmit -p test/tsconfig.json`：成功。
- 変更2TS（harness、新規flow）へ既存ESLint + typescript-eslint recommendedをESLint APIで追加適用：0 errors/0 warnings。共有設定変更なし。
- client/ `npm run lint`：既存23 errors/37 warnings。`npm run typecheck`：production build生成型と既存同期paramsの不整合53診断。今回変更ファイルの診断なし。ログは `/tmp/item-draft-real-get-lint.log`・`/tmp/item-draft-real-get-client-types.log`・`/tmp/item-draft-real-get-client-test-types.log`。本番修正は範囲外。
- 解消した未検証範囲は実GETの公開契約→SSR、他人404、未入力値、Chromium/Firefoxの代表編集・削除・再訪に限る。WebKit後段、F11の他のseed/監視/遷移先内容、Bの代替API、Node26・通常Turbopack・カバレッジは残す。失敗期待値の変更・skip化なし。

以下は以前の検証履歴。実GETに関する現在の状態は本節を優先する。

## getItemDraftPage契約への型整合（2026-10-29、追加検証）

- ユーザー確定の数値ID・非再帰の親/子カテゴリ配列・関連nullを `draft/types.ts` とfixtureへ反映。updatedAtは文字列のまま保持する。fixtureのAPI対象外createdAt/video_statusを除外。
- 初回回帰は103件中102成功・1失敗。U-N06だけ旧URL `/item-draft/11` を期待していたため、確定契約 `/item-draft/11/item-page` へ期待値を更新した。
- Node 22.22.2、client/で `node node_modules/vitest/vitest.mjs run src/app/item/draft/test src/app/item/draft/api/test test/integration/components/item/itemDraftPage test/integration/pages/item/itemDraftPage/itemDraftPage.test.tsx`：11ファイル103件成功、失敗/skip 0。
- `node node_modules/typescript/bin/tsc --noEmit -p test/tsconfig.json` と変更した7個のTS/TSXへのESLint追加検査は成功。対象fixture・単体・DOM結合の回帰であり、ブラウザー/E2E/実DBは今回再実行していない。
- 本番 `node node_modules/typescript/bin/tsc --noEmit` は成功（worktreeに生成済みnext-env.d.tsを参照）。全体 `node node_modules/eslint/bin/eslint.js .` は既存23エラー・37警告で失敗。対象7 TS/TSXへの診断は0であり、既存Todo `docs/todo/P3-techdebt/restore-client-lint-baseline.md` の残件として扱う。
- 既存U-V03/C-S01は入力のID/関連構造だけ更新し、表示・XSS検証は維持。新しい動作のテスト追加はない。以下の全383件の記録は前回実行の履歴であり、今回の103件へ重複加算しない。

## F2〜F10修正・全件検証（2026-10-29、最新）

今回の全件とは本レポート対象ページの実装済み383件（U133/C・P55/B117/E78）。リポジトリ全体の別機能テストは対象外。全件runに関連ケースの再検証を上書きして重複を除いた結果を以下に示す。失敗・timeoutも終了した結果であり、全仕様合格を意味しない。

- F2：共通 `client/src/components/operation/operation.tsx` のOperationProvider/useOperationでページ内編集・削除の同期ガードとbusyを共有。成功後は保持、失敗時解除。Containerは表示だけのページでも使うため、適用箇所は下書きページのみに限定。
- F3：削除成功後のguardを遷移まで維持し、削除開始ボタンもbusyで無効化。
- F4：開始・閉鎖button、名前付きdialog、初期focus・Tab/Shift+Tab循環・Escape・復帰を実装。閉鎖button自体にクリック領域を設定。ItemPeekにtabIndexとEnter/Space対応。
- F5：少量在庫のboolean描画を修正し在庫文言を表示。
- F6：画像・色カードを名前付きkeyboard操作に対応し、開閉状態を公開。画像閉鎖後focus復帰。
- F7：今回の修正依頼に従い設計の個別low_stock_ratio以下・在庫正数の契約へ統一。境界期待値は維持。
- F8：空convertedUrlから元動画URLへfallback。
- F9：既存時計固定・keyboard操作を維持。disabled開始ボタンは無理にclick待機せず無効状態とHTTP1回をassert。
- F10：既に修正済みの実text429→alert契約を維持しE-F02を再検証。本番rate limiter応答形式は変更なし。

単体133件・DOM結合55件は全成功。単体・結合の各ファイル対応は既存2章を維持し、今回失敗0。対象コードの期待値は緩和していない。slideshow単体は複数画像の先頭triggerを明示し、B/Eの旧SVG構造参照は名前付きbuttonへ更新した。

| project        | 成功 | 失敗 | timeout | その他 |
| -------------- | ---: | ---: | ------: | -----: |
| pages-chromium |   39 |    0 |       0 |      0 |
| pages-firefox  |   39 |    0 |       0 |      0 |
| pages-webkit   |   37 |    2 |       0 |      0 |
| e2e-chromium   |   26 |    0 |       0 |      0 |
| e2e-firefox    |   26 |    0 |       0 |      0 |
| e2e-webkit     |    4 |   13 |       9 |      0 |

| 階層 | 実ファイル（各テストルート基準）                         | 成功 | 失敗 | timeout |
| ---- | -------------------------------------------------------- | ---: | ---: | ------: |
| B    | `item/itemDraftPage/components.spec.ts`                  |   40 |    2 |       0 |
| B    | `item/itemDraftPage/operations.spec.ts`                  |   18 |    0 |       0 |
| B    | `item/itemDraftPage/page.spec.ts`                        |   57 |    0 |       0 |
| E    | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` |   21 |    6 |       3 |
| E    | `item/itemDraftPage/deleteItemDraft/flow.spec.ts`        |   35 |    7 |       6 |

最終集計：{'passed': 359, 'failed': 15, 'timedOut': 9}。skip・interrupted・未着手0。U/C/Pのtodo・未処理例外0、B/Eのトップレベルerrors0。カバレッジ未取得。

### 残る失敗・未到達

- pages-webkit / B-N02 元動画の実再生と集計未送信：failed。
- pages-webkit / Q10 元動画の実再生と集計未送信：failed。
- e2e-webkit / E-N01 上編集から実APIとDBへ引き継ぐ：timedOut。
- e2e-webkit / E-N01 下編集から実APIとDBへ引き継ぐ：timedOut。
- e2e-webkit / E-N02 未入力データを表示用補完に変換せず編集へ保存：timedOut。
- e2e-webkit / E-F01 編集拒否とDB不変：failed。
- e2e-webkit / E-S02 編集拒否とDB不変：failed。
- e2e-webkit / E-S03 編集拒否とDB不変：failed。
- e2e-webkit / E-F02 実編集レート6回目は429でDB不変：failed。
- e2e-webkit / E-N05 編集消費後の再訪とリロードで古い操作を出さない：failed。
- e2e-webkit / E-S01 署名不正tokenは実401で編集拒否：failed。
- e2e-webkit / E-N04 実削除の成功通知・遷移と対象だけの物理削除：timedOut。
- e2e-webkit / E-F01 削除consumedを拒否してDB不変：failed。
- e2e-webkit / E-S02 削除otherを拒否してDB不変：failed。
- e2e-webkit / E-S03 削除zeroを拒否してDB不変：failed。
- e2e-webkit / E-S03 削除overflowを拒否してDB不変：failed。
- e2e-webkit / E-F02 実削除レート21回目は429、非JSON失敗をalertで通知：failed。
- e2e-webkit / E-N05 削除後の再訪とリロードで操作不可：failed。
- e2e-webkit / E-Q01 delete-repeatで実APIへの重複・相反送信を止める：timedOut。
- e2e-webkit / E-Q01 edit-bothで実APIへの重複・相反送信を止める：timedOut。
- e2e-webkit / E-Q01 edit-deleteで実APIへの重複・相反送信を止める：timedOut。
- e2e-webkit / E-Q01 delete-editで実APIへの重複・相反送信を止める：timedOut。
- e2e-webkit / E-S01 署名不正tokenは実401で削除拒否：failed。
- e2e-webkit / E-Q01 削除成功後1500ms内に同じ対象を再送しない：timedOut。

WebKit B-N02/Q10はMediaRecorderが利用できずテスト動画生成時点で失敗。実動画再生の本番判定不可。WebKit Eは実access-token cookieが得られない失敗と操作待ちtimeoutが主で、根本原因未確定。前段で失敗したケースのDB照合・後続assertまで成功したとはしない。Chromium/FirefoxのEは各ケース結果表を参照。新たなskipやexpected failureは追加していない。

### 未実装・未施行の残件

- F11：簡略F-full seedの全非null動画/variantsコピー、遷移先フォーム・一覧内容、S3 SDK非通信監視、公開Item・owner等の保護snapshot、schema guardの全型・enum/FK検証は未実装。
- B-O01の全画像・動画/request総数・性能SLA、全般のa11y保証、未ログインmetadata専用assert、エラー時全操作の網羅的CSR送信0等、3章に記載した不足は残る。
- 実GET未実装部分はDB-backed proxy/テストAPIの代替のまま。完全な実GET込みE2Eではない。
- Node26、通常Turbopack、カバレッジは未施行。migration/syncは実施していない。実行待ち・中断ケースはない。

### 実行環境・証拠・静的検査

Node22.22.2。U/C/Pは既存4章と同じ対象コマンド、出力を `/tmp/item-f2-unit-final.json`・`/tmp/item-f2-integration-final.json` へ変更。各133/55件成功。B/E全runも4章の同じコマンド・ローカルURL、workers=1、trace=off、reporter=jsonで `/tmp/item-f2-browser-final.json`・`/tmp/item-f2-e2e-final.json` へ出力。API/認証/DB/外部サービスの境界は4章と同じ。ログ・JSONは一時成果物。

B再検証は同コマンドのgrep `B-N03|Q03 edit-delete`、続いて `B-N03`、最終ビルドで `Q06|Q03|Q04`。集計は後の結果をproject/file/title一致で置換し加算しない。Eはgrep `E-N03.*icon` を最終ビルドで再実行し同様に置換。証拠：`/tmp/item-f2-browser-recheck.json`、`/tmp/item-f2-browser-image-final.json`、`/tmp/item-f2-browser-move-final.json`、`/tmp/item-f2-e2e-close-final.json`。途中の旧DOM参照timeoutとクリック領域不備のrunは最終集計に含めない。

webpack buildは共通コンポーネント移動・閉鎖領域修正後も成功（`/tmp/item-f2-build-final.log`）。全B/Eは移動前の同処理build、最終変更に関連するB12件/E3件は最終buildで検証。U/C/Pは移動後に再実行し、最後の閉鎖領域修正後は削除単体5件も再実行。最終ソースで全383件を一括再実行したものではない。

対象lint・clientテスト用tsc・test型検査は成功（`/tmp/item-f2-target-lint-final.log`、`/tmp/item-f2-test-types-final.log`、`/tmp/item-f2-e2e-types.log`）。本番typecheckはNext生成型と同期params等の既存不整合で失敗。lintはユーザー指定に従い `/app/item` のエラーのみ記録：commentSection/replyList.tsxのany、commentText.tsxのrender中ref参照。これらの本番修正は範囲外。対象修正ファイルにlintエラーなし。

以下は過去の結果。F1〜F10の現在の状態はこの節を正とする。

## F1修正・部分再検証（2026-10-29）

`client/src/app/item/draft/delete.tsx` に送信前の同期refガードとdisabled用stateを追加。失敗時のみ解除し、成功時は遷移まで保持する。F1/Q01の修正は実装済み・U/Cで検証済み。ページの編集・削除共有排他（F2）は対象外。成功後のガード保持はF3にも影響するが、F3/Q04の検証完了とはしていない。

client/で以下の対象だけを実行し、**単体1ファイル5件、結合1ファイル11件、計16件すべて成功**。失敗・skip・todo・未処理例外0。再実行分を下記の過去の全件集計へ加算しない。

```bash
npm run test:unit -- src/app/item/draft/test/delete.test.tsx --reporter=json --outputFile=/tmp/item-draft-f1-unit.json
npm run test:integration -- test/integration/components/item/itemDraftPage/deleteItemDraft/integration.test.tsx --reporter=json --outputFile=/tmp/item-draft-f1-integration.json
```

U-N03/U-N04/U-F02でキャンセル・成功通知・1500ms後の遷移・失敗後の再試行を回帰。CのQ01ではMSWに実到達したDELETEをクリック連打・Enter連打とも1回と確認し、処理中disabledも確認した。既存の期待値は変更していない。単体はAPI/router/通知を代替、結合は実fetch＋MSWであり、実DBは使用しない。B/E・他のテストは今回再実行せず、カバレッジ未取得。Node.js 22.22.2。

対象ESLintとテスト用 `tsc --noEmit -p test/tsconfig.json` は成功（`/tmp/item-draft-f1-lint.log`、`/tmp/item-draft-f1-test-types.log`）。本番 `npm run typecheck` は既存のNext.js生成型とページparams等の不整合で失敗（`/tmp/item-draft-f1-types.log`）。全体lintは今回未実行。上記JSON・ログは一時成果物。

以下は修正前の全件結果・履歴。F1の現在の状態はこの節を正とする。

## 最新結果（2026-10-29 再開）

B/Eの全195件を再実行した。**成功117、失敗69、タイムアウト9、skip0**。両ランナーはexit 1で正常に結果を出力し、トップレベルerrors・flakyは0。設計全体の合格ではない。詳細は[全件実行結果](#6-2026-10-29-全件実行結果)を参照。

今回U/C/Pは再実行していない（前回：成功156・失敗32）。未実装assertや、失敗によって未到達となった後段の検証は残る。本番コード・DBスキーマは変更していない。以下の1〜5章は2026-10-28の履歴であり、B/Eの件数とテスト手順修正の現在の状態は6章を正とする。

## 1. 2026-10-28実行履歴・当時の完了範囲

実行日：2026-10-28。対象：[テスト設計書](../../architecture/item/itemDraftPage.md)。以下のパスは特記がなければリポジトリルート基準。
カバレッジは未取得。Node.js 22.22.2を使用し、指定Node.js 26では未確認。秘密値・トークン・接続URL全体は転記しない。

| 階層 | 展開件数 | 最新結果                      |
| ---- | -------: | ----------------------------- |
| U    |      133 | 成功119、失敗14               |
| C/P  |       55 | 成功37、失敗18                |
| B    |      117 | 成功71、失敗46                |
| E    |       78 | 成功46、失敗23、タイムアウト9 |

ブラウザー別・B/Eファイル別の最新結果は6章を参照。

2026-10-28の完了済みブラウザー結果：

| project        | 結果                          |
| -------------- | ----------------------------- |
| e2e-chromium   | 成功21、失敗5                 |
| pages-chromium | 成功24、失敗14、タイムアウト1 |

## 2. テストファイルごとの結果

fixtureは `client/test/fixtures/item/itemDraftPage/` と `test/fixtures/item/itemDraftPage/`、設定変更は `client/vitest.config.mts`。下表は実ファイル単位でありdescribe数をファイル数にしていない。

| 実ファイル                                                                                   | 結果（ブラウザーは3projectを含む） |
| -------------------------------------------------------------------------------------------- | ---------------------------------- |
| `client/src/app/item/draft/api/test/client.test.ts`                                          | 成功6                              |
| `client/src/app/item/draft/api/test/server.test.ts`                                          | 成功2                              |
| `client/src/app/item/draft/test/delete.test.tsx`                                             | 成功5                              |
| `client/src/app/item/draft/test/editButton.test.tsx`                                         | 成功3                              |
| `client/src/app/item/draft/test/itemDraftPage.test.tsx`                                      | 成功4                              |
| `client/src/app/item/draft/test/itemSection.test.tsx`                                        | 成功17                             |
| `client/src/app/item/draft/test/videoSection.test.tsx`                                       | 成功11                             |
| `client/src/app/item/itemSection/test/categoryText.test.tsx`                                 | 成功3                              |
| `client/src/app/item/itemSection/test/deliverySection.test.tsx`                              | 成功9、失敗6                       |
| `client/src/app/item/itemSection/test/detail.test.tsx`                                       | 成功4                              |
| `client/src/app/item/itemSection/test/itemHeader.test.tsx`                                   | 成功8                              |
| `client/src/app/item/itemSection/test/itemName.test.tsx`                                     | 成功3                              |
| `client/src/app/item/itemSection/test/slideshow.test.tsx`                                    | 成功3、失敗1                       |
| `client/src/app/item/itemSection/test/variantsList.test.tsx`                                 | 成功13、失敗4                      |
| `client/src/app/item/videoSection/test/itemPeek.test.tsx`                                    | 成功7、失敗2                       |
| `client/src/app/item/videoSection/test/summary.test.tsx`                                     | 成功4                              |
| `client/src/app/item/videoSection/test/videoElem.test.tsx`                                   | 成功7、失敗1                       |
| `client/src/components/container/test/container.test.tsx`                                    | 成功2                              |
| `client/src/lib/test/formatRelativeTime.test.ts`                                             | 成功8                              |
| `client/test/integration/components/item/itemDraftPage/deleteItemDraft/integration.test.tsx` | 成功9、失敗2                       |
| `client/test/integration/components/item/itemDraftPage/editButton/integration.test.tsx`      | 成功9                              |
| `client/test/integration/components/item/itemDraftPage/itemSection/integration.test.tsx`     | 成功5、失敗9                       |
| `client/test/integration/pages/item/itemDraftPage/itemDraftPage.test.tsx`                    | 成功14、失敗7                      |

## 3. 設計ケースごとの対応・判定

件数は各IDに対応する実テストの内訳。条件の一部成功を全レベル成功に読み替えない。同一IDのU/C/P/Bも分けて表示し、未作成assertは未実装として下欄に記す。

| 設計ID | 実装ファイル／階層・結果                                                                                                                                                                | 判定・残る条件                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| U-N01  | U（itemDraftPage.test.tsx）：成功1                                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V01  | U（itemDraftPage.test.tsx）：成功3                                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V02  | U（videoSection.test.tsx）：成功11                                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V03  | U（itemSection.test.tsx）：成功17                                                                                                                                                       | 実装・実行した範囲は成功。                                                                                                  |
| U-N02  | U（editButton.test.tsx）：成功1                                                                                                                                                         | 実装・実行した範囲は成功。                                                                                                  |
| U-F01  | U（editButton.test.tsx）：成功2                                                                                                                                                         | 実装・実行した範囲は成功。                                                                                                  |
| U-N03  | U（delete.test.tsx）：成功2                                                                                                                                                             | 実装・実行した範囲は成功。                                                                                                  |
| U-N04  | U（delete.test.tsx）：成功1                                                                                                                                                             | 実装・実行した範囲は成功。                                                                                                  |
| U-F02  | U（delete.test.tsx）：成功2                                                                                                                                                             | 実装・実行した範囲は成功。                                                                                                  |
| U-N05  | U（client.test.ts）：成功4                                                                                                                                                              | 実装・実行した範囲は成功。                                                                                                  |
| U-V04  | U（client.test.ts）：成功2                                                                                                                                                              | 実装・実行した範囲は成功。                                                                                                  |
| U-N06  | U（server.test.ts）：成功2                                                                                                                                                              | 実装・実行した範囲は成功。                                                                                                  |
| U-N07  | U（videoElem.test.tsx）：成功7                                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| U-N08  | U（itemPeek.test.tsx）：成功6                                                                                                                                                           | 実装・実行した範囲は成功。                                                                                                  |
| U-N09  | U（detail.test.tsx / summary.test.tsx）：成功6                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| U-N10  | U（slideshow.test.tsx）：成功3                                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| U-N11  | U（itemHeader.test.tsx / itemName.test.tsx）：成功9                                                                                                                                     | 実装・実行した範囲は成功。                                                                                                  |
| U-N12  | U（variantsList.test.tsx）：成功2                                                                                                                                                       | 実装・実行した範囲は成功。                                                                                                  |
| U-V05  | U（variantsList.test.tsx）：成功5                                                                                                                                                       | 実装・実行した範囲は成功。                                                                                                  |
| U-N13  | U（categoryText.test.tsx / container.test.tsx / deliverySection.test.tsx）：成功12                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| U-V06  | U（formatRelativeTime.test.ts）：成功8                                                                                                                                                  | 実装・実行した範囲は成功。                                                                                                  |
| U-S01  | U（categoryText.test.tsx / deliverySection.test.tsx / detail.test.tsx / itemHeader.test.tsx / itemName.test.tsx / itemPeek.test.tsx / summary.test.tsx / variantsList.test.tsx）：成功8 | 実装・実行した範囲は成功。                                                                                                  |
| C-N01  | C/P（editButton/integration.test.tsx）：成功1                                                                                                                                           | 実装・実行した範囲は成功。                                                                                                  |
| C-F01  | C/P（editButton/integration.test.tsx）：成功7                                                                                                                                           | 実装・実行した範囲は成功。                                                                                                  |
| C-N02  | C/P（deleteItemDraft/integration.test.tsx）：成功1                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| C-F02  | C/P（deleteItemDraft/integration.test.tsx）：成功7                                                                                                                                      | 実装・実行した範囲は成功。                                                                                                  |
| C-F03  | C/P（deleteItemDraft/integration.test.tsx / editButton/integration.test.tsx）：成功2                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| C-N03  | C/P（itemSection/integration.test.tsx）：成功2                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| C-N04  | C/P（itemSection/integration.test.tsx）：成功1                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| C-S01  | C/P（itemSection/integration.test.tsx）：成功1                                                                                                                                          | 実装・実行した範囲は成功。                                                                                                  |
| P-N01  | C/P（itemDraftPage.test.tsx）：成功6                                                                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| P-N02  | C/P（itemDraftPage.test.tsx）：成功6                                                                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| P-F01  | C/P（itemDraftPage.test.tsx）：成功2                                                                                                                                                    | 実装・実行した範囲は成功。                                                                                                  |
| B-N01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumの標準／未入力SSR・Hydrationを確認。全ブラウザー保証ではない。                                                      |
| B-N02  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumで生成した短いcanvas動画を実再生。概要／説明の開閉・スクロールはChromium/Firefoxで確認。                            |
| B-N03  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| B-S01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | URL、非表示、GET0回を確認。未ログイン時metadata非露出の専用assertは未実装。                                                 |
| B-S02  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumで他人／nullの拒否とtrim後一致を確認。                                                                              |
| B-N04  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumで標準／未入力metadataと同一描画内GET1回を確認。                                                                    |
| B-F01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumで401/404/500/接続断。非表示の全操作・CSR送信0の網羅的assertには不足あり。                                          |
| B-N05  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumで4画面幅・長い商品名・横overflow・確認ボタンを確認。                                                               |
| B-N06  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 実URLと戻る/reloadを確認。遷移先API不足により編集フォーム内容の保証なし。                                                   |
| B-S03  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| B-O01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 画像complete＋naturalWidthと失敗要求・操作時間のみ。全画像/動画の読込・request総数・性能SLAは未実装／未確定。               |
| Q01    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 失敗あり。問題検出の詳細は修正案を参照。                                                                                    |
| Q02    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 失敗あり。問題検出の詳細は修正案を参照。                                                                                    |
| Q03    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Bのdelete-editはoverlayが編集クリックを遮り30秒timeout。Bの本番判定不可。PとEでは相反HTTP送信を検出。                       |
| Q04    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | PとEで再送を検出。Bはclock.pauseAtの過去時刻指定でテストコードが失敗し、本番判定不可。                                      |
| Q05    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 削除開始／閉鎖とItemPeekをU/Pで分離。Bは削除開始のrole不足で止まり、後段は未実行。                                          |
| Q06    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumはdialog不存在で失敗しTab/Shift+Tab/Escape/復帰は未到達。                                                           |
| Q07    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 失敗あり。問題検出の詳細は修正案を参照。                                                                                    |
| Q08    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Uでは画像拡大とvariantsを個別検証し両方失敗。Bは画像拡大の名前付きbutton不足で止まり後段未到達。                            |
| Q09    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 個別ratio=0.3を要求する追加品質契約。色current=3とサイズcurrent=2/4で失敗。業務側合意は残件。                               |
| Q10    | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | UとChromiumで空converted_urlが元動画srcを設定しないことを検出。                                                             |
| E-N01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 実POST201、コピー列・管理値・元行消費・保護snapshotを確認。F-fullの動画・variantsは標準設計より簡略なseedで追加条件未実装。 |
| E-N02  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 実POST201、未入力値コピーと元行消費を確認。遷移先フォーム内容・全管理値の専用assertは未実装。                               |
| E-N03  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| E-N04  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 実DELETE200、対象消失・編集増加0・保護snapshot。S3 SDK非通信の実監視は未実装。                                              |
| E-F01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| E-S01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| E-S02  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| E-S03  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 全ブラウザーの実行結果は6章を参照。                                                                                         |
| E-F02  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | 実レート制限の編集6回目／削除21回目。削除429は非JSONでalert、後続停止・DB不変を確認。                                       |
| E-Q01  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | Chromiumで5操作すべて余分なHTTPを検出。先頭4操作はsoft assert後DB確認も実施。成功後1500ms再送は件数失敗で後段へ未到達。     |
| E-N05  | 最新の実行件数は6章の同IDを参照。                                                                                                                                                       | URL・戻る/reload・操作なしとDB状態。表示取得は代替のため実GETの保証なし。                                                   |

### 実装・保証が残る範囲

- 遷移先 `/upload/[id]`・`/my-page` はURLまで。対象外APIの不足によるエラーもあり、フォーム／一覧内容までは保証しない。
- EのF-fullは画像・商品・セール・配送・参照IDを含むが、動画URL・duration等はnull、色・サイズvariantsなし。設計F-media/F-attrsの全非nullコピー条件は未実装。実行成功件数からこの不足を除外できない。
- EはD2/D3/E0と7参照マスターを全列比較。公開Itemのseed・保護snapshot、S3 SDK非通信監視、owner User等の追加保護snapshotは未実装。
- schema guardは接続先test_db、主要型・nullable・コピー列・主要FK方向を検証。enum値、日時型、item_editing.item_id FK、全master型は未確認。migration・syncは未実行。
- Q系は最初のassertで止まった場合、後段のfocus trap・Escape・遷移・DB assertを実行済みとしない。B-Q04は時計制御のテスト不備、B-Q03逆順はoverlay操作手順の不備が残る。
- 新しい `test/fixtures/item/itemDraftPage/startNext.mjs` は再現用launcherとして作成したが、ユーザー指示後の実行・lintは未実施。現在の実行証拠は同じenvを設定した一時起動スクリプトとnpm startによる。

## 4. 実処理・モック・実行証拠

- U：対象部品を実行し、子部品・API・router・通知を境界で代替。HLS/Swiperの単体代替で実再生・レイアウトは保証しない。
- C/P：専用fetchと共通apiFetchは実処理、HTTPはMSW、認証token取得・router・通知を代替。削除sleepはC/Pでgate、実1499/1500msはUで確認。VideoTitleだけ同期代替。
- B：実Next.js、実Server/Client Component・metadata・所有者照合・SSR/Hydration。GET等は4011のテストAPI、認証はNextAuth暗号化cookie fixture。BのJWTは業務認証の実証に使わない。CSR操作APIはpage.routeによる代替。
- E：実NextAuth credentialsログイン、実access-token、実Express Router/middleware/usecase/service、実test_db。未実装GETのみDB-backed proxyで代替。重複ケースはroute.fetchで実APIを通してから応答だけgateで保留。Expressはcron起動を避けた隔離プロセスで、アプリ全体のbootstrap検証ではない。
- DB接続元はserver/.env.testに限定。pg接続とExpressのdb.ts/models側の各接続を確認。fixtureで今回作成IDを追跡し逆依存順にcleanupし、残存0を確認する。実行後の全DB横断照合は未確認。トップレベルteardown errorはJSONにない。
- 既定3000番が使用中だったため専用3011/3012へ変更。既存サービスは停止していない。今回のNext.js、APIサーバー、テストランナーは後片付けした。

集計元（/tmpの一時成果物、永続保存を保証しない）：

- `/tmp/item-draft-unit-final.json`：133件。`/tmp/item-draft-integration-final.json`：55件。
- `/tmp/item-draft-browser-final.json`：117件。`/tmp/item-draft-e2e-final.json`：78件。後者2runはユーザー指示でexit130。
- 静的検査：`client/npm run lint` は既存23error/35warningで失敗（`/tmp/item-draft-lint.log`）。この時点の追加コードに診断なしと、最新全ファイルのlint成功は別。
- 専用・共有単体と初期C/Pの対象lintは成功。B初期版lintは0error/2未使用引数warning。B/E・launcherの最新lintは6章を参照。
- `client/npm run typecheck` は初期U/C/P時点で成功。最新B/E TSを含む `client/tsc --noEmit -p test/tsconfig.json` と `test/npm run typecheck` は成功（`/tmp/item-draft-test-types-final.log`、`/tmp/item-draft-e2e-types-final.log`）。最新全体npm typecheckの再実行は未実施。
- build：通常Turbopackはcompile段階で11分以上進まず当該processだけ停止（exit143、原因未確定）。制限外WebpackとローカルURL固定buildは成功。Node26での検証なし。

### 再現コマンド（再開時用、指示後には実行していない）

```bash
# client/、依存導入済み・Node指定環境で
npm run test:unit -- src/app/item/draft/test/ src/app/item/draft/api/test/ src/app/item/videoSection/test/ src/app/item/itemSection/test/ src/components/container/test/ src/lib/test/formatRelativeTime.test.ts --reporter=json --outputFile=/tmp/item-draft-unit-final.json
npm run test:integration -- test/integration/components/item/itemDraftPage/ test/integration/pages/item/itemDraftPage/ --reporter=json --outputFile=/tmp/item-draft-integration-final.json
NEXT_PUBLIC_API_URL=http://127.0.0.1:5021/api API_URL=http://127.0.0.1:4011 NEXTAUTH_URL=http://127.0.0.1:3011 NEXTAUTH_SECRET=item-draft-browser-local-fixture-secret npm run build -- --webpack
# 別processでB用API（Node22なら--experimental-strip-types、Node26は環境に合わせる）
node --experimental-strip-types test/fixtures/item/itemDraftPage/apiServer.ts
# リポジトリルートのtest/で、別processにてモードごと起動
node fixtures/item/itemDraftPage/startNext.mjs browser
node fixtures/item/itemDraftPage/startNext.mjs e2e
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3011 ./node_modules/.bin/playwright test test/integration/pages/item/itemDraftPage/ --workers=1 --trace=off --reporter=json > /tmp/item-draft-browser-final.json
# test/でE。server/.env.testとtest_dbの反映済みschemaが必要
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3012 ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:5021/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4022/api ./node_modules/.bin/playwright test E2E/item/itemDraftPage/ --workers=1 --trace=off --reporter=json > /tmp/item-draft-e2e-final.json
```

## 5. 結果に基づく修正案（すべて提案のみ）

本番修正は実施していない。既存の通常ケース・Q系の期待値を維持し、下記を実装後、元IDで再実行する。未実施部分の補完に機械的な新IDは付けない。

| 修正ID・元ケース                       | 対象・確認した原因／修正前条件                                                                        | 修正方針・修正後の契約・再検証                                                                                                                                                               |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F1：Q01                                | draft/delete.tsx。保留中の連打／EnterでDELETE3回（C）、実Eで2回                                       | 再入防止ref等を送信開始前に設定し、button disabledと状態を同期。失敗時のみ解除。U/C/B/Eの重複送信0を確認                                                                                     |
| F2：Q02/Q03/E-Q01                      | draft/itemDraftPage.tsx/editButton.tsx/delete.tsx。各編集state独立で上下POST2回、編集と削除も両方送信 | ページ単位の操作中状態を共有して、編集・削除の相反操作を排他。親の同期guardと子のdisabledを組み合わせる。バックエンド排他を代用品にせずHTTP1回を要求                                         |
| F3：Q04/E-Q01                          | 削除200後、1500ms待ちに再び確認を開けDELETE追加                                                       | 成功確定状態を遷移まで維持し再開放しない。通知・遷移も1回。元U-N04/C-N02とP/E-Qの成功・失敗回復を回帰                                                                                        |
| F4：Q05/Q06                            | 削除開始p、閉じるSVG、ItemPeek roleのみ。実ブラウザーでbutton/dialogが見つからない                    | 名前付きbutton、dialogのlabel/modal属性、初期focus・Tab/ShiftTab trap・Escape・復帰を実装。ItemPeekのキーボード操作も対応。テストのrole要求を弱めない                                        |
| F5：Q07                                | deliverySection.tsx。initial2〜4の三項演算子が文言でなくbooleanを返す                                 | 条件計算と描画を分け、current1=残りわずか、2以上=在庫ありを描画。SOLDと通常在庫・素材の既存assertも維持                                                                                      |
| F6：Q08                                | slideshow.tsx/variantsList.tsx。画像・閉じる・色カードがdiv/SVGのclick依存                            | 名前付き操作・keyboard・開閉状態を公開し実マウス操作も維持。Q08の前段だけでなく画像閉鎖とvariantsまで独立に検証                                                                              |
| F7：Q09                                | variantsList.tsx。色が0.2固定、サイズがratio以上で低在庫                                              | 設計で要求した「0より大きく個別閾値以下」を業務側と合意して統一。0/閾値直前/一致/直後を維持。未合意を理由に現コードへassertを書換えない                                                      |
| F8：Q10                                | videoElem.tsx。表示は論理和、source選択はnull合体で空convertedが元URLを遮断                           | 再生可能な非空URLへfallbackを統一。元URLのsrc設定・実play・HLS cleanup・集計未送信を回帰                                                                                                     |
| F9：B-Q03/Q04                          | operations.spec.ts。削除overlayが編集へのmouse操作を遮る。clock.pauseAtの+50msが操作遅延で過去となる  | overlay越しpointerを強制せず実keyboard操作等で相反要求を再現。時計は初期から固定し、成功後に相対制御する。今回はユーザー指示で修正・再実行せず、テスト不備として残す                         |
| F10：E-F02（初回テスト不備は修正済み） | 実rate limiterは既定text応答。JSON429を想定したトーストassertが不適合                                 | 既存契約のJSON解析失敗→alertを実応答で検証するようテストだけ修正し、最新runで成功。HTTP429/遷移なし/DB不変assertは維持。APIのJSON統一は別の提案で、本番未修正                                |
| F11：未実装条件                        | 最新の実行件数は6章の同IDを参照。                                                                     | レポート3章の不足を元IDへ補完し、追加条件を検証する。S3監視は実SDK境界の記録など対象処理を置き換えない方法を別途設計。取得GET実装後は代替を外した完全E2Eを追加                               |
| F12：実行設定                          | 既存PostCSS文字列配列がViteの収集を止めた                                                             | Vitestだけcss.postcss.plugins=[]を設定済み。本番CSS未変更。DOMでは実レイアウト保証をせずBへ分離。通常ケースと型検査が通ったことを確認済み。Node26/通常Turbopack停止原因/最新全対象lintは残件 |

修正実装を再開する際は、各Fと元ID、変更ファイル、期待値の維持／追加、回帰結果をこの文書へ追記する。今回の検出は本番修正完了を意味しない。

## 6. 2026-10-29 全件実行結果

### 実行範囲・環境・変更

- B全117件、E全78件を3ブラウザーで完走。前回結果との重複加算なし。Node.js 22.22.2、既存のproduction buildをstartNext.mjsのbrowser/e2eモードで起動した。今回はbuildを再実行していない。Node26・通常Turbopack検証は残る。
- F9のテスト不備をoperations.spec.tsで修正。Q03削除→編集はoverlay越しのマウスクリックをEnter操作へ変更。Q04は時計をinstall時から固定し、操作後の過去時刻指定を除去。期待値は維持し、いずれも3ブラウザーで業務要求の排他・再送防止のassertまで到達して失敗した。Q04は期待1回に対してDELETE2回。
- 再現コマンドは4章のB/Eコマンドと同じ対象・環境変数・workers=1・trace=off・reporter=json。出力先のみ `/tmp/item-draft-browser-resume.json`、`/tmp/item-draft-e2e-resume.json`。これらは一時成果物。
- 実処理・モック境界は4章と同じ。Eはtest_dbへの実API検証、migration/sync未実施。個別fixtureのcleanup後にトップレベルエラーなし。DB全体の独立した残存検査は未実施。

### ファイル・ブラウザー別結果

| project        | ファイル（各テストルート基準）                           | 成功 | 失敗 | timeout |
| -------------- | -------------------------------------------------------- | ---: | ---: | ------: |
| pages-chromium | `item/itemDraftPage/components.spec.ts`                  |    5 |    9 |       0 |
| pages-firefox  | `item/itemDraftPage/components.spec.ts`                  |    5 |    9 |       0 |
| pages-webkit   | `item/itemDraftPage/components.spec.ts`                  |    4 |   10 |       0 |
| pages-chromium | `item/itemDraftPage/operations.spec.ts`                  |    0 |    6 |       0 |
| pages-firefox  | `item/itemDraftPage/operations.spec.ts`                  |    0 |    6 |       0 |
| pages-webkit   | `item/itemDraftPage/operations.spec.ts`                  |    0 |    6 |       0 |
| pages-chromium | `item/itemDraftPage/page.spec.ts`                        |   19 |    0 |       0 |
| pages-firefox  | `item/itemDraftPage/page.spec.ts`                        |   19 |    0 |       0 |
| pages-webkit   | `item/itemDraftPage/page.spec.ts`                        |   19 |    0 |       0 |
| e2e-chromium   | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` |   10 |    0 |       0 |
| e2e-firefox    | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` |   10 |    0 |       0 |
| e2e-webkit     | `item/itemDraftPage/createItemEditingDraft/flow.spec.ts` |    1 |    6 |       3 |
| e2e-chromium   | `item/itemDraftPage/deleteItemDraft/flow.spec.ts`        |   11 |    5 |       0 |
| e2e-firefox    | `item/itemDraftPage/deleteItemDraft/flow.spec.ts`        |   11 |    5 |       0 |
| e2e-webkit     | `item/itemDraftPage/deleteItemDraft/flow.spec.ts`        |    3 |    7 |       6 |

### ケース対応（3ブラウザー合算）

元IDと実ファイルの対応は3章を維持。下表は今回の展開テスト数であり、ID数ではない。

| 階層    | ID    | 成功 | 失敗 | timeout |
| ------- | ----- | ---: | ---: | ------: |
| browser | B-N02 |    5 |    1 |       0 |
| browser | B-N03 |    3 |    0 |       0 |
| browser | Q05   |    0 |    3 |       0 |
| browser | Q06   |    0 |    3 |       0 |
| browser | Q08   |    0 |    3 |       0 |
| browser | B-O01 |    3 |    0 |       0 |
| browser | Q07   |    0 |    6 |       0 |
| browser | Q09   |    3 |    9 |       0 |
| browser | Q10   |    0 |    3 |       0 |
| browser | Q01   |    0 |    3 |       0 |
| browser | Q02   |    0 |    6 |       0 |
| browser | Q03   |    0 |    6 |       0 |
| browser | Q04   |    0 |    3 |       0 |
| browser | B-N01 |    6 |    0 |       0 |
| browser | B-N04 |    9 |    0 |       0 |
| browser | B-S01 |    3 |    0 |       0 |
| browser | B-S02 |    9 |    0 |       0 |
| browser | B-F01 |   12 |    0 |       0 |
| browser | B-N05 |   12 |    0 |       0 |
| browser | B-S03 |    3 |    0 |       0 |
| browser | B-N06 |    3 |    0 |       0 |
| e2e     | E-N01 |    4 |    0 |       2 |
| e2e     | E-N02 |    2 |    0 |       1 |
| e2e     | E-F01 |    4 |    2 |       0 |
| e2e     | E-S02 |    4 |    2 |       0 |
| e2e     | E-S03 |    6 |    3 |       0 |
| e2e     | E-S01 |   10 |    2 |       0 |
| e2e     | E-F02 |    4 |    2 |       0 |
| e2e     | E-N05 |    4 |    2 |       0 |
| e2e     | E-N03 |    6 |    0 |       0 |
| e2e     | E-N04 |    2 |    0 |       1 |
| e2e     | E-Q01 |    0 |   10 |       5 |

### 判定・残件と静的検査

- F1〜F8は本番未修正。Q系の失敗を合格やskipへ変更していない。F9はテスト修正・再検証済み。B-Q04はテスト時計のエラーではなく再送検出に更新した。
- WebKit Eは成功4、失敗13、timeout9。複数ケースでmiddlewareが設定するaccess-token cookie不存在を検出し、編集・削除操作待ちでtimeoutも発生。OSライブラリ不足ではない。認証・cookieの根本原因は未確定で、これらを業務ロジックの不具合と断定しない。前段で失敗したケースのDB・後段assertは未検証。
- 簡略seed、遷移先内容、S3監視、公開Item等の保護snapshot、schema guard不足、B-O01不足など3章の未実装範囲は今回追加していない。カバレッジ未取得。
- client `npm run lint`：失敗、23 errors/37 warnings。今回の修正以外の既存コードにエラー。`npm run typecheck`：失敗、53診断（生成 `.next/types` とページの同期params定義等の不整合）。`/tmp/item-draft-lint-resume.log`、`/tmp/item-draft-types-resume.log`。
- client `tsc --noEmit -p test/tsconfig.json` と test `npm run typecheck`：成功。`/tmp/item-draft-test-types-resume.log`、`/tmp/item-draft-e2e-types-resume.log`。
- client `eslint test/integration/pages/item/itemDraftPage test/fixtures/item/itemDraftPage`：0 errors/2 warnings（既存page.spec.tsの未使用request）。E2E/fixture/launcherの6ファイルは既存typescript-eslint recommendedをESLint APIで適用し0 errors/0 warnings。共有設定の変更なし。実行スクリプト `/tmp/item-draft-eslint-resume.mjs`、結果 `/tmp/item-draft-e2e-lint-resume.log`。startNext.mjsは今回両モードの起動を確認済み。

### 2026-10-29 レポート照合

保存済みPlaywright JSONを再集計し、B117件・E78件の全195件に終端結果があること、skip・interruptedが0件であることを確認した。実装済みテストの実行待ちはない。失敗・timeoutによる未到達assert、未実装条件、Node26等の未確認環境は残る。今回は文書のみ更新し、テストは再実行していない。旧途中集計を削除し、最新結果へ参照を統一した。
