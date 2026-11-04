# 商品アップロード・商品編集ページ テスト結果・修正案

## 1. 最新結果と範囲

実施日: 2026-11-04。対象は `/upload/[id]`・`/upload/edit/[id]`。
レポート本体は `client/test/docs/report/upload/itemUpload.md` に配置する。旧配置 `client/docs/report/upload/itemUpload.md` から移動した。テスト結果・実行日は移動前の記録を保持し、移動に伴うテスト再実行は行っていない。

[設計書](../../architecture/upload/itemUpload.md) に基づきテストコードを追加。本番コード・依存・DBスキーマは変更していない。失敗を修正済みとして扱わず、修正案を第5節に示す。ケースIDと展開後の実行件数は異なる。


最新の実行集計は **250件中237成功・13失敗**。単体143件（139成功/4失敗）、Form結合59件（57/2）、ページ結合40件（40/0）、実DB E2E8件（1/7）。skip/todo・未処理例外なし。失敗は描画非収束、既存属性画像の欠落、実APIの入力契約不整合。失敗するテストを残しており、全テスト成功ではない。

以下のパスは `client/` 基準。`test/E2E/`・`docs/`・`server/` はリポジトリルート基準。JSON・ログは `/tmp` の一時集計資料であり、主要結果は本書にも残す。カバレッジ未取得。人間観測 O01〜O05 は全件「人間確認待ち」。

## 2. 実装と検証境界

| 対象 | 実処理・置換 | 保証限界 |
| --- | --- | --- |
| Hook検証・body変換 | useUpload本体、型付きfixture。必須・在庫・価格・素材境界と本文比較 | APIでの業務検証を代替しない |
| 転送Hook | 実fetchをMSWで受け、POST fields/file順序、PUT内容・Content-Type・Bearer非転送。変換API関数は単体でspy | S3/ffmpeg品質・DB反映は保証しない |
| 機能API単体 | 共通apiFetch/serverをspyしpath/options/body/応答/rejectを検証 | 実認証・HTTP/DBを保証しない |
| 分離したForm結合 | 実Form・入力部品・Hooks・API・共通apiFetch、HTTPのみMSW。barrelは使用3部品の実装へ限定。Image/Router/通知/assign/sleepは観測用代替 | GenderAgeは実装の無限更新によりこの群のみnullへ置換。フォーム全体が成功したとはみなさない。遷移はassign引数まで |
| 実Form全体 | 実GenderAgeを含む初期描画。Profilerで30commitを超えたら明示エラー | 無限ループでランナーが停止しないためのガード。合否を緩和しない。SSR保証は含まない |

Form結合はnormal/edit双方の本文・Bearer・成功先、HTTP失敗/ネットワーク/不正JSON、トークンなしのHTTP未実行、同一操作の連打、validation停止を検証。新規メディアでは登録/下書きそれぞれ「保存→動画→変換→サムネイル→商品画像→属性画像」の各段階へ失敗を注入し、後続通信・成功通知・遷移がないことを確認した。

## 3. ケース対応と残る範囲

| 設計ID | 主な実装ファイル/結果の読み方 |
| --- | --- |
| U01〜U05、Q01/Q06 | `src/app/upload/hooks/test/useUpload.test.ts`。必須単項欠落、価格・素材境界、色/サイズ合計、下書き緩和、body・不変性 |
| U06〜U16、Q03/Q06/Q08 | `src/app/upload/test/` の8ファイル。UI実操作・親state更新・HTTP候補取得。GenderAgeは4条件とも描画段階で失敗し、制約変更後の操作は未到達 |
| U17〜U19 | `src/app/upload/api/test/{server,item,video}.test.ts` |
| U20〜U24、Q04/Q05 | `src/app/upload/hooks/test/useFileUpload.test.ts`。逆順署名・画像不足・再転送は現行観測として成功しても問題解消を意味しない |
| C01/C03〜C08、Q02/Q07/Q09 | `test/integration/components/upload/itemUploadPage/form/integration.test.tsx`、`media.test.tsx`。一部条件は下記残件参照 |
| U10/C03 | `test/integration/components/upload/itemUploadPage/form/fullForm.test.tsx`。実初期描画の収束に失敗 |

未確認条件をIDが登場するだけで完了としない。特に、実GenderAgeを含むC08のカテゴリー→対象補正→送信、別タブのQ02、再送時のDB結果、ファイル転送とDBの全体整合性は、分離Formテストでは保証していない。UIメディア選択はfireEventでFileList相当を注入しており、OSファイル選択の操作感は人間観測に残す。

## 4. 実行環境・再現コマンド

既存依存を使用。実行Nodeは `v22.22.2`（PATHに `/home/conta/.nvm/versions/node/v22.22.2/bin` を設定）、既存package.jsonの指定はNode26であり、指定ランタイムでの再検証は未実施。依存追加や共有設定変更で検査を通していない。

```bash
cd client
npm run test:unit -- src/app/upload --reporter=json --outputFile=/tmp/upload-unit-results.json
npm run test:integration -- test/integration/components/upload --reporter=json --outputFile=/tmp/upload-form-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

全lintは既存コードの23 errors/36 warningsで失敗（`/tmp/upload-lint.log`）。uploadを含む既存effect内setState等の診断がある。変更テスト群の対象ESLintは成功（`/tmp/upload-target-lint.log`）。本番typecheckは50診断で失敗（`/tmp/upload-typecheck.log`）。既存 `.next/types` の非Promise params診断と `src/app/upload/ok/[id]/page.tsx` の `Item.seller_id` 不在がある。追加テストの型エラーと区別する。テスト用tsconfigは成功（`/tmp/upload-test-typecheck.log`）。Next生成型を含む本番検査と収集範囲が異なる。

## 5. 失敗・観測に基づく修正案

以下すべて提案のみ。本番修正・修正後検証は未実施。仕様未確定項目は仕様判断後に契約を更新し、元ケースを維持して再検証する。

| 修正ID・元ケース | 再現条件・実際の結果・原因 | 修正案と修正後の検証 |
| --- | --- | --- |
| F1 U10/C03 | 実Form初期描画が30commit以内に収束せず失敗。GenderAgeで毎render生成する候補配列をeffect依存に持ち、effectで新しいラベル配列をsetStateして再renderする | 候補/ラベルをpropsから導出し、effectは値補正のみに限定。候補の参照を安定させるか不要な派生stateを削除。無制約/単一制約/制約変更で収束、親state補正、送信bodyを実結合で再検証。分離テストの代替を実部品へ戻す |
| F2 C03/C08 | 既存色にuiIdがない状態で商品名を入力後出品すると属性imageが2件ともnullとなり保持テスト失敗。Formは初期配列/mapを毎render生成し新UUIDを採番するが、state側_uiIdは初回のまま | 初期属性値・画像mapを同じ一度限りの初期化で生成し、resolverは保持したmapを参照。uiIdあり/なし、入力変更・色削除・画像差替え・下書きの各経路で対応と画像保持を再検証 |
| F3 Q01 | 下書き色合計2/全在庫3を「超過」と拒否、3/2は通過。現行条件は `<` | 許容条件を業務確認。超過拒否が契約なら `>` へ修正し、未満/等値/超過とサイズの対応を確認。現行観測を仕様成功としない |
| F4 Q04 | 署名mapがblue→red順だとREDをblue先、BLUEをred先へ転送。色削除後も先頭署名へ残存Fileを送る。Object.valuesとFile抽出順を対応させている | 応答mapキーの契約を確認し、uiIdをキーに対象Fileを解決。署名順序/画像なし色/削除色の混在で内容を比較。バックエンド返却キーも合わせて確認 |
| F5 Q02/C07 | 成功後1500ms待機に入る前にloading解除され、再クリックでPUT・遷移が2回。出品中も下書きPOSTが開始できる | 共通送信状態で両ボタンを相互排他にし、遷移完了まで保持。即時の二重呼出しもref等で防止し、unmount後遷移を抑制。別タブの冪等性/競合制御はAPI側責務として別途検証 |
| F6 Q05/D04 | Fileと署名の片方不足でskip成功。成功後flagsは更新されず同じ引数で再転送。保存と転送のtransactionは別 | 必要転送の署名欠落をエラーとし、転送済み状態と再試行対象を管理。下書きPOSTでediting削除後の再送方針はAPI契約と合わせて検討。単純なフロント再試行だけで原子性を保証しない |
| F7 Q03 | ブランド/カテゴリーの旧応答を後着させると新候補を上書き。ブランド選択後手入力しても旧id保持、`A&B#C`検索はkeyword=Aとして送信 | request世代管理またはAbortControllerで旧応答を抑制し、手入力時はid=null。URLSearchParamsでencode。逆順・空語・特殊文字・unmount後を再検証 |
| F8 Q08 | 動画のObjectURLが再描画ごとに生成され解放されない。価格props1000→0で利益900/手数料100が残る | メディアURLを安定化しcleanupで解放。価格派生金額をpropsから計算。再描画・削除・unmountと価格0への変更を再検証 |
| F9 Q09 | 変換PATCHの202受付後、完了照会なしに確認先へ進む現行動作を再現。詳細設計では202は内部エラー/実変換完了を保証しない | 受付と完了のUI契約を明確化し、必要なら状態照会・確認画面でのprocessing/failed表示へ接続する。HTTP非2xxだけの判定を実変換成功とみなさず、非同期完了のケースを追加。APIの202自体は確定仕様であり不具合とは断定しない |


| F10 D01/D02/D04 | 正規フォームからのPUT/POSTが400 INVALID_BODY。実送信bodyを本番ZodでsafeParseし、video.type/thumbnail.type=null（optional string期待）、category.id/brand.id/condition.id/shipping.day/service/place=number（string期待）、category.level=0（>=1期待）を検出。GETの関連IDは数値、Categoryの取得属性にlevelがなくFormが0へ初期化する | GET DTO・Form初期値・createBody・PUT/POST schemaを一貫させる。IDの文字列化をフロント境界で行うかAPI契約側を整合し、既存ファイルはtypeの省略/nullの正規契約へ統一。getMyItemEditingFormでCategory.levelを取得する案。型定義だけで修正済みとせず実GET→UI→POST/PUTで確認。parent_idの数値不整合は本fixtureではnullのため未実測。F10解消後にD04転送失敗とD05実変換へ進める |

Q06の負数/小数・MIME・長文の直接注入はUI属性とHook検証の違いを示す観測。すべてを新規フロント制約として追加する案にはせず、API側の確定制約・責務と照合して判断する。

## 6. 単体・Form結合の最終実行内訳

単体本体142件と追加layout1件は対象ファイルが重ならないため合算する。Form結合59件も別群。合計202件中196成功・6失敗、skip/todo・未処理例外なし。過去の試行を重複加算しない。

| 階層 | ファイル | 成功 | 失敗 |
| --- | --- | ---: | ---: |
| 単体 | `src/app/upload/test/attributes.test.tsx` | 6 | 0 |
| 単体 | `src/app/upload/test/brandInput.test.tsx` | 9 | 0 |
| 単体 | `src/app/upload/test/category.test.tsx` | 8 | 0 |
| 単体 | `src/app/upload/test/fields.test.tsx` | 13 | 0 |
| 単体 | `src/app/upload/test/genderAge.test.tsx` | 0 | 4 |
| 単体 | `src/app/upload/test/itemImage.test.tsx` | 7 | 0 |
| 単体 | `src/app/upload/test/uploadUI.test.tsx` | 3 | 0 |
| 単体 | `src/app/upload/test/videoInput.test.tsx` | 10 | 0 |
| 単体 | `src/app/upload/api/test/item.test.ts` | 4 | 0 |
| 単体 | `src/app/upload/api/test/server.test.ts` | 2 | 0 |
| 単体 | `src/app/upload/api/test/video.test.ts` | 4 | 0 |
| 単体 | `src/app/upload/hooks/test/useFileUpload.test.ts` | 25 | 0 |
| 単体 | `src/app/upload/hooks/test/useUpload.test.ts` | 47 | 0 |
| 単体追加 | `src/app/upload/test/layout.test.tsx` | 1 | 0 |
| Form結合 | `test/integration/components/upload/itemUploadPage/form/fullForm.test.tsx` | 0 | 1 |
| Form結合 | `test/integration/components/upload/itemUploadPage/form/integration.test.tsx` | 42 | 1 |
| Form結合 | `test/integration/components/upload/itemUploadPage/form/media.test.tsx` | 15 | 0 |

集計根拠: `/tmp/upload-unit-results.json`、`/tmp/upload-layout-results.json`、`/tmp/upload-form-results.json`。ファイルは単体14・Form結合3。describe数の集計ではない。

初期試行ではテストsetupのhoisted export、Toaster向けmatchMedia欠如を修正して再実行した。これらはテスト環境側の問題であり本番不具合の件数に含めない。修正後の上表を最新結果とする。

## 7. ページ結合の実行結果

最終40件すべて成功（Chromium）。2ページ各20件で、所有者・trim文字列所有者・未認証GET未実行・第三者非公開、nullable初期値、metadata title/description/robots、GETエラー・非JSON・切断、不正ID・不存在IDを確認した。価格を2000へ入力し利益1,800の表示変化を待ってClient state更新を確認。pageerrorおよびhydration/maximum update depthに関するconsole errorも収集した。

対象: `test/integration/pages/upload/{itemUploadPage,itemUploadEditPage}/page.spec.ts`、共通 `test/fixtures/upload/browser/`。集計根拠 `/tmp/upload-pages-complete.json`。初期36件の試行は最終40件へ置換し加算しない。SSRとClient state更新の観測は長時間の更新収束・全制約の保証ではなく、開発用React/ProfilerでのF1失敗と区別する。

サーバー発GETはローカルAPIサーバーへ置換し、DBを含まない。Chromium以外のprojectは収集のみ。通常Turbopack buildはworktreeのnode_modules symlink制約で失敗したため、`next build --webpack` を使用して成功した。既存 `next.config` のignoreBuildErrors=trueによりbuild成功は型検査成功を意味しない。

## 8. 実DB E2Eの結果と履歴

最終8件中1成功・7失敗。集計根拠 `/tmp/upload-e2e-diagnosed.json`。業務APIは実Express・実test_db、既存confirm用harnessを再利用し、専用ユーザー/自作IDでseed・cleanup。マイグレーションは実行していない。

| ファイル（リポジトリルート基準） | 成功 | 失敗 | 到達範囲 |
| --- | ---: | ---: | --- |
| `test/E2E/upload/itemUploadPage/saveEditing/flow.spec.ts` | 0 | 2 | normal/edit両モードで実PUT→400 INVALID_BODY。保存・確認GET・公開item不変の後続assertは未到達 |
| `test/E2E/upload/itemUploadPage/saveDraft/flow.spec.ts` | 0 | 1 | 実POST→400 INVALID_BODY。editing削除/draft保存のassertは未到達 |
| `test/E2E/upload/itemUploadPage/authorization/flow.spec.ts` | 1 | 0 | 他人GET404、完全な有効bodyのPUT/POSTで他人404、不正ID400、未認証GET401。前後DB snapshotと保護行の不変を検証 |
| `test/E2E/upload/itemUploadPage/transferFailure/flow.spec.ts` | 0 | 4 | 動画/サムネイル/商品/属性の外部転送失敗を予定する4件。実保存API400で停止し転送障害注入と保存後DB確認は未到達 |

D01の編集モードは通常側ファイルのmodeパラメーターで実行する（編集側README参照）。D04の失敗をストレージ障害として数えず、保存前の契約不一致として扱う。正規送信を改変してAPIを通過させていない。実送信bodyの検証診断はpath/code/messageのみ記録し、署名URLやトークンを添付しない。

初期試行ではブラウザーsandbox起動、明示loopback URLガード、API接続先未整合によるHTML応答のJSON解析失敗があった。制限外実行・fixture設定とbuild時NEXT_PUBLIC_API_URLを修正して再実行し、これらを本番不具合として集計していない。変換PATCHについて初期テストが同期400/404を期待した点も修正した。詳細設計では202境界で非同期実行するため、最終D03ではGET/PUT/POSTの認可を確認し、変換jobの完了・認可の内部状態は未保証として残す。共有confirm用serverProcessは本番の変換応答境界を完全再現していないため、その差を本番API不具合としない。

## 9. 未達・人間確認待ち

- U10は初期描画で停止するため、全enumのラジオ操作・制約変更後の収束と、実GenderAgeを含むC08の最終本文は未確認。
- Q02はDOM内の両送信順・成功待機中再送を再現。別タブでの競合・冪等性は未確認。Q05の不整合flags全組合せとForm内resolver差の全経路は未確認。
- D04の保存成功後の転送失敗・残存DB確認、D05の新規動画の実変換完了/失敗、実S3/ffmpeg、メディアを含む完全な保存成功経路は未確認。単体/MSWの成功で補完済みとはしない。
- P/DはChromiumを実行対象とし、Firefox/WebKitは収集対象の確認まで。ブラウザー互換性・レスポンシブ・操作感・キーボード/フォーカス・体感性能のO01〜O05は人間確認待ち。
- カバレッジ・定量性能は未取得。Node26、本番同等の外部サービス、全既存回帰を一括再検証したものではない。

今回の完了範囲はテスト実装・上記範囲の実行・失敗箇所の修正案作成。機能全体の検証成功、本番修正、修正後の再検証完了とはしない。

## 10. ブラウザー・E2E再現手順

Node22のPATH設定後に実行。既存fixtureが隔離用 `server/.env.test` を読む。実行前にtest_dbガード、ローカルサービスの空きポート、既存依存・ブラウザーを確認する。環境の秘密値はコマンドへ展開しない。サービスは別プロセスで起動し終了後停止する。

```bash
# client/: ブラウザー発APIのベースURLはbuild時に必要
NEXT_PUBLIC_API_URL=http://127.0.0.1:4043/api npm run build -- --webpack

# リポジトリルート: 別々のプロセスで起動
node client/test/fixtures/upload/browser/api.mjs
node client/test/fixtures/upload/browser/startNext.mjs
ITEM_CONFIRM_E2E_TLS_URL=https://127.0.0.1:3443 node test/fixtures/item/itemConfirmPage/startNext.mjs e2e

# client/: ページ結合
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3041 npm run test:pages:browser -- test/integration/pages/upload --project pages-chromium --workers 1 --timeout 12000 --reporter=json

# test/: 実DB E2E
PLAYWRIGHT_BASE_URL=https://127.0.0.1:3443 \
ITEM_CONFIRM_E2E_TLS_URL=https://127.0.0.1:3443 \
ITEM_CONFIRM_E2E_EXPRESS_URL=http://127.0.0.1:4042/api \
ITEM_CONFIRM_E2E_PROXY_URL=http://127.0.0.1:4043/api \
npm run test:e2e -- E2E/upload --project e2e-chromium --workers 1 --timeout 30000 --reporter=json
```

E2EのExpress/proxyは既存harnessが起動し、DB接続先をtest_dbと照合する。worktreeで再現する場合は依存・隔離設定への参照を用意する必要がある。今回作成したworktree内の依存/設定symlink、fixture起動プロセスは後片付け済み。既存データ全体の削除・既存migration変更/実行は行っていない。

統合後の追加静的検査: clientの対象ESLint成功（`/tmp/upload-target-lint-final.log`）、clientテスト用型検査成功（`/tmp/upload-test-typecheck-final.log`）、testパッケージ型検査成功（`/tmp/upload-e2e-typecheck-final.log`）。E2E追加TSはリポジトリルートから `client/node_modules/.bin/eslint --config client/eslint.config.mjs test/E2E/upload` で追加検査しexit 0。React/packageとpages探索の設定警告は出たが対象コード診断なし（`/tmp/upload-e2e-lint-final.log`）。共有設定は変更していない。文書の相対リンクと `git diff --check` も確認した。
