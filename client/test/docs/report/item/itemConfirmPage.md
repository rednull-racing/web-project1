# itemConfirmPage テストレポート

## 2026-11-01 F1・F2修正・再検証（最新）

F1/F2を本番コードへ反映した。以下の初回検証と「提案のみ」の記述は修正前の履歴であり、現行契約・解消状況は本節を優先する。F3の対象外静的診断は未修正。

### 変更と期待値の更新

- **F1：修正済み。** UploadButtonのPOST/PUTを同じ送信ガードで保護し、state反映前の同期再入もrefで拒否する。送信開始から成功後1500msの待機・遷移要求まで送信/同意変更/編集を無効にし、失敗時だけ復旧する。閉じる・再表示をしてもpendingは維持する。
- 応答前/成功待機中にunmountした場合、その後の通知・state更新・遷移要求を無効化する。すでにサーバーで始まった保存処理を取り消したとは扱わない。
- **F2：修正済み。** native dialogのshowModalでtop layerと背景inertを使用。dialog名、名前付き閉じるbutton、初期focus、Tab/Shift+Tab循環、Escape/閉じる/背景クリック、開くボタンへのfocus復帰を実装。開いている間は背景スクロールを停止し、閉じると元へ戻す。
- 共通Backを名前付きbuttonへ変更し、従来の履歴戻り/url指定pushと見た目を維持してEnter/Spaceへ対応する。
- C-O01/B-O01は観測から通常の合否assertへ移行。旧結果は下の履歴へ保持する。AF-F1は同期再入・応答前unmount、AF-F2はdialogのfocus/キー操作を追加し、既存の正常/異常/再試行契約を維持した。

### 今回の実行結果

- 単体・共有回帰：27ファイル222件成功（`/tmp/f1-f2-unit-final.json`）。DOM結合：4ファイル34件成功（`/tmp/f1-f2-integration.json`）。
- productionブラウザー結合：最終132件成功。停止前runは131成功/1失敗（`/tmp/f1-f2-browser-final.json`）。失敗したWebKit B-N02 normalはログイン画面の事前読込に関するaccess controlエラーをpageerrorとして検出したもので、11月1日の同条件再実行は成功（`/tmp/f1-f2-browser-resume.json`）。旧1件を置換し重複加算しない。元のエラーの恒久解消までは保証しない。
- F1/F2の通常assertは3ブラウザーで成功。今回の合計は388件で、前回E2E66件を再実行件数へ混ぜない。
- production build、対象ESLint、テスト専用型検査は成功。全体lintは既存23 errors/37 warnings、build後の本番typecheckは既存49診断で失敗。範囲外のF3は未修正。
- 上記一括検証は10月30日の停止前結果を確認して採用し、11月1日は残ったブラウザー1件と送信/Backの単体20件を再実行して成功（`/tmp/f1-f2-resume-unit.log`）。過去の検証を今回すべて再実行したとは扱わない。

### 検証境界・途中の失敗

単体はAPI依存・router・通知・待機を制御する。DOM結合は実API wrapper/共通fetchを使用しHTTPだけをMSWへ置換。jsdomのdialog API代替は専用fixtureでshowModal/closeのみ提供し、テストcleanup後に復元する。native top layer/背景inertをjsdomで保証したとは扱わず、production Nextと3ブラウザーで実証する。

初回のDOM失敗はdialog API代替の復元がDOM cleanupより先に走ったため。fixtureでcleanup後に復元するよう訂正し再実行した。B-O01初回はスクロール可能な規約欄がブラウザーでTab対象になることを無視したテストの誤期待。各Tabでdialog内focusを保ったままcheckboxへ到達するassertへ訂正し、背景逸脱防止は弱めていない。途中の作業ディレクトリ指定ミス・中断したrunは最終集計に加算しない。

実認証・Express・DBの66件E2Eは前回結果であり**今回再実行していない**。今回はAPI契約/業務処理/DBを変更せず、UIの排他とnative modal・Backの変更を単体/HTTP結合/productionブラウザー回帰で検証する。全バックエンドの重複防止・すべての競合順序・外部サービスの保証を追加しない。

### 再現コマンド（Node.js 22.22.2、client/）

```bash
npm run test:unit -- src/app/item/confirm src/app/item/itemSection/test src/app/item/videoSection/test src/components/container/test src/components/title-back/test src/components/terms/test src/lib/api/test/confirmClient.test.ts src/lib/api/test/confirmServer.test.ts src/lib/test/formatRelativeTime.test.ts src/lib/test/sleep.test.ts --maxWorkers=2 --reporter=json --outputFile=/tmp/f1-f2-unit-final.json
npm run test:integration -- test/integration/components/item/itemConfirmPage test/integration/pages/item/itemConfirmPage --maxWorkers=2 --reporter=json --outputFile=/tmp/f1-f2-integration.json
npm run build -- --webpack
# 別ターミナルで専用API・Nextを起動
node test/fixtures/item/itemConfirmPage/browserApi.mjs
node test/fixtures/item/itemConfirmPage/browserStart.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3031 PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/f1-f2-browser-final.json npm run test:pages:browser -- test/integration/pages/item/itemConfirmPage/confirm.spec.ts --workers=2 --reporter=list,json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

今回の変更ファイルに限定した既存ESLintによる検査も実施し、通常lint全体の結果とは区別する。設計書・ページAGENTSも現行の排他/modal契約に更新した。

## 2026-10-30 初回検証履歴（F1・F2修正前）

[テスト設計書](../../architecture/item/itemConfirmPage.md)に基づき、新規出品・更新の2ページを検証した。対象の本番コード・共有設定は変更していない。テストの不備はテスト側で修正し、本番の失敗や仕様未確定の観測を分けて記録する。以下のパスは特記しない限りclient/基準。E2Eのtest/はリポジトリルート基準。

**最終集計は単体211件、DOM結合34件、ブラウザー結合132件、E2E66件の計443件成功**（観測ケースを含む）。最終採用結果の失敗・skip・todo・flaky・未処理例外は0。途中のテスト環境起因の失敗と中断は以下に履歴として残し、最終結果へ重複加算しない。

機能修正は行っておらず、再送・操作性の観測問題（F1/F2）が残る。全体lintは既存23エラー/37警告、build後の本番typecheckは既存49診断で失敗。追加テストの型検査・個別lintとproduction buildは成功。全機能の修正完了を意味しない。

### 単体のファイル別結果

| ファイル（client/基準）                                  | 成功/全件 |
| -------------------------------------------------------- | --------- |
| `src/lib/test/formatRelativeTime.test.ts`                | 8/8       |
| `src/lib/test/sleep.test.ts`                             | 9/9       |
| `src/components/container/test/container.test.tsx`       | 2/2       |
| `src/components/terms/test/termsList.test.tsx`           | 1/1       |
| `src/components/title-back/test/back.test.tsx`           | 1/1       |
| `src/lib/api/test/confirmClient.test.ts`                 | 7/7       |
| `src/lib/api/test/confirmServer.test.ts`                 | 9/9       |
| `src/app/item/confirm/test/itemConfirmPage.test.tsx`     | 5/5       |
| `src/app/item/confirm/test/itemSection.test.tsx`         | 5/5       |
| `src/app/item/confirm/test/title.test.tsx`               | 2/2       |
| `src/app/item/confirm/test/uploadButton.test.tsx`        | 8/8       |
| `src/app/item/confirm/test/videoSection.test.tsx`        | 2/2       |
| `src/app/item/itemSection/test/categoryText.test.tsx`    | 3/3       |
| `src/app/item/itemSection/test/confirmContract.test.tsx` | 32/32     |
| `src/app/item/itemSection/test/confirmDetail.test.tsx`   | 3/3       |
| `src/app/item/itemSection/test/deliverySection.test.tsx` | 15/15     |
| `src/app/item/itemSection/test/detail.test.tsx`          | 4/4       |
| `src/app/item/itemSection/test/itemHeader.test.tsx`      | 8/8       |
| `src/app/item/itemSection/test/itemName.test.tsx`        | 3/3       |
| `src/app/item/itemSection/test/slideshow.test.tsx`       | 6/6       |
| `src/app/item/itemSection/test/variantsList.test.tsx`    | 19/19     |
| `src/app/item/videoSection/test/confirmPreview.test.tsx` | 4/4       |
| `src/app/item/videoSection/test/itemPeek.test.tsx`       | 18/18     |
| `src/app/item/videoSection/test/summary.test.tsx`        | 4/4       |
| `src/app/item/videoSection/test/videoElem.test.tsx`      | 8/8       |
| `src/app/item/confirm/api/test/client.test.ts`           | 18/18     |
| `src/app/item/confirm/api/test/server.test.ts`           | 7/7       |

### DOM結合のファイル別結果

| ファイル末尾                         | 成功/全件 |
| ------------------------------------ | --------- |
| `uploadButton/uploadButton.test.tsx` | 24/24     |
| `itemSection/itemSection.test.tsx`   | 3/3       |
| `videoSection/videoSection.test.tsx` | 3/3       |
| ページ `confirm.test.tsx`            | 4/4       |

集計元は一時成果物 `/tmp/item-confirm-unit-integrated.json` と `/tmp/item-confirm-integration.json`。単体は新規ケースと既存共有回帰の合計で、設計IDの数ではない。

### ブラウザー結合の最終結果

1 specファイル・44条件×3ブラウザーの**132件成功**（観測12件を含む）、失敗・skip・flakyなし。集計は `/tmp/item-confirm-browser-complete.json` の動画再生6件を除いた126件成功と、修正後の動画6件 `/tmp/item-confirm-browser-media-final.json` の成功をID・project名で置換照合した。旧版の動画4件成功・2件失敗を重複加算しない。

| 設計ID | 最終成功/全件 | 内容                                                         |
| ------ | ------------- | ------------------------------------------------------------ |
| B-N01  | 18/18         | 両ルート×metadata名3条件×3ブラウザー                         |
| B-N02  | 12/12         | 実画像/説明/スクロール/履歴/reloadとMP4実再生                |
| B-N03  | 24/24         | 375/767/768/1280px×両ルート×3ブラウザー                      |
| B-E01  | 12/12         | 未認証・SSR認証切れ                                          |
| B-E02  | 42/42         | 詳細所有者・HTTPエラー、metadata単独失敗と機密・操作非露出   |
| B-E03  | 12/12         | HTML風文字と遅延GET/送信停止                                 |
| B-O01  | 6/6（観測）   | キー操作・focus・Escape・Backの観測。F2参照                  |
| B-O02  | 6/6（観測）   | 1600px画像、長文、30variants、低速メディア失敗、status不一致 |

B-O02で表示・画像読込・30variants確認まで1585～3318ms、pageerror/Hydrationエラーなし。ただし固定の性能目標への合格を意味しない。動画404はHTTP応答として観測し、requestfailedイベントがないことを通信成功と誤認しない。

途中のmetadata404のHTTP200はNextのstreaming応答であり、404 status自体を誤要求したテストをNot Found表示・機密本文/操作非露出のassertへ訂正した。遅延GETの検証はnavigationを完了待ちするLocatorを避け、通信開始→未完了/未送信→release→DOM確認の順へ訂正し、6件の限定再検証後に全体を実行した。

動画再生の初回WebKit2件はMediaRecorder未定義でfixture生成前に停止したテスト環境の問題。自己生成したH.264 MP4を専用fixtureとして固定し、同じファイルで3ブラウザー×両ルートの再生・currentTime進行と集計APIなしを再確認した。元動画のUI不具合として数えない。

### E2Eの最終結果

3 specファイル・22条件×3ブラウザーの**66件成功**。内訳はcreateItem 3件、getItemConfirmPage 42件、updateItem 21件。最終採用結果の失敗・skip・flaky・未処理例外なし。

| 設計ID | 成功/全件   | 内容                                                                    |
| ------ | ----------- | ----------------------------------------------------------------------- |
| E-N01  | 3/3         | 実出品・完了先本文・商品/動画/配送/セール保存・在庫リセット・編集元消費 |
| E-N02  | 3/3         | 実更新・商品本文・同一商品/関連ID・在庫リセット・別商品不変             |
| E-N03  | 24/24       | 両ルート×名前4条件×3ブラウザー、専用GET/metadata・DB不変                |
| E-E01  | 24/24       | 未認証/他人/不存在GET、他人/0への直接POST/PUT、DB不変                   |
| E-E02  | 6/6         | 表示後の編集元削除、実404・成功遷移なし・部分保存なし                   |
| E-O01  | 6/6（観測） | 二タブ送信と再送。商品重複なし・編集元消費                              |

根拠は `/tmp/item-confirm-e2e-final.json` のChromium/Firefox各22件成功と `/tmp/item-confirm-e2e-webkit-https-api.json` のWebKit22件成功。旧HTTP WebKit22件をすべて後者で置換し、旧成功14件も重複加算していない。前者はHTTP/既存公開API URLのbuild、後者はHTTPS/API-HTTPS専用buildという環境差を明記する。全66件を同一build・同一通信環境で一括検証したものではない。

E-O01は全3ブラウザーで二タブの応答が201/404、再送404。所有者の商品数はnormalが既存1＋作成1の2、editが既存1のままで重複なし。これらの順序での永続化保護を確認したもので、すべての競合順序やフロント再送防止を保証しない。F1の通信多重化は別に残る。

後片付けは各ケースの作成ID限定DELETE後SELECTで確認した。さらに最終採用runの実API記録から抽出した当タスクのitem_editing 54 IDs・item 7 IDsをread-only照合し、残存0。担当のNext/TLS/Express/proxy（3032/3042/4042/4043）は停止、一時TLS証明書ディレクトリも残存0を確認した。他タスクの行を削除していない。

初回のPUT成功ステータス200期待は現行controllerの201へ訂正。完了先で必要なnotification routerが隔離Expressへ未登録だったテスト環境も修正し、完了先本文と後続DB assertを維持して再実行した。これらを本番不具合とは数えない。

## 実処理・モック・環境

- Node.js 22.22.2、Vitest 5、RTL/jsdom、MSW、Playwrightを使用。リポジトリ指定のNode26での検証ではない。
- 単体は依存子部品・認証・fetch・router等を制御して引数、分岐、例外、後続未実行を確認。共通fetch自身のテストはfetch/JWT/Next境界を置換した。
- DOM結合はItemConfirmPage、UploadButton、表示の共有部品、API wrapperと共通fetchを実処理にし、HTTPをMSWへ置換。認証取得、router、toast、Next/Image、Swiper、Hls等のブラウザー境界を制御。async VideoTitleのみ同期のh3へ置換しているため、asyncルート・SSRの保証はブラウザー検証へ分離した。
- C-N01はHTTP完了後、sleepの開始を制御して1499msで遷移なし、1500msで返却商品IDへ遷移することを確認。通常のページ結合では待機を置換し遷移要求までを確認する。
- ブラウザー結合はproduction Next.jsとテストAPIサーバーを使用し、SSR GETとブラウザー送信を別々に制御。E2Eは実Express・テストPostgreSQLへ接続し、対象業務レスポンスをモックしない。詳しい範囲と制約は後述する。
- 共通setupのcleanup、MSW reset、fake timer復元に従いケースを分離。今回のカバレッジ率は未取得。観測ケースの成功を二重送信防止・アクセシビリティや性能目標達成と同一視しない。

## 設計IDと実装・実行の対応

| 設計ID              | 実装ファイル                                                                                                                 | 検証内容・境界                                                                  |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| U-N01               | `src/app/item/confirm/test/title.test.tsx`                                                                                   | normal/editの表示文言                                                           |
| U-N02               | 同 `itemConfirmPage.test.tsx`                                                                                                | 在庫0/1/省略のsoldout、id/page、子部品への接続                                  |
| U-N03               | 同 `videoSection.test.tsx`                                                                                                   | フィールド対応、概要null補完、日付、normalPage省略・itemId null                 |
| U-N04               | 同 `itemSection.test.tsx`                                                                                                    | 関連null・割引補完・variants件数・共有部品の入力                                |
| U-N05、U-E01        | 同 `uploadButton.test.tsx`                                                                                                   | 規約42件、同意、閉じる/再表示、編集リンク、エラー・再試行停止                   |
| U-A01、U-A03、U-O01 | `src/app/item/confirm/api/test/client.test.ts`                                                                               | POST/PUT、数値JSON、戻り値、例外、不正ID変換の観測                              |
| U-A02、U-A03        | 同 `server.test.ts`                                                                                                          | 詳細/metadata専用URL・no-store・name nullable・例外伝播                         |
| U-A04、U-A05        | `src/lib/api/test/confirmClient.test.ts`、`confirmServer.test.ts`                                                            | 認証有無、認証ヘッダー、HTTP/JSON失敗、login/notFound/throw                     |
| U-S01～03           | `src/app/item/itemSection/test/confirmContract.test.tsx` と既存itemHeader/itemName/deliverySection/categoryTextテスト        | confirmの価格・性別/年齢・recommend非表示、在庫境界、素材合計                   |
| U-S04               | 同 `variantsList.test.tsx`                                                                                                   | カラー/サイズ在庫、比率省略時の既定0.2、操作・表示境界                          |
| U-S05               | 同 `detail.test.tsx`・`confirmDetail.test.tsx`、`src/app/item/videoSection/test/summary.test.tsx`・`confirmPreview.test.tsx` | 高さ境界・空文・開閉・confirm入力での加点抑止                                   |
| U-S06               | 同 `videoElem.test.tsx`・`confirmPreview.test.tsx`                                                                           | HLS対応/非対応・URL変更/破棄・動画なし・確認画面の再生数抑止                    |
| U-S07               | `src/app/item/itemSection/test/slideshow.test.tsx`                                                                           | 0/1/複数画像、2枚目のキー操作、モーダル・focus復帰                              |
| U-S08               | `src/components/{container,title-back,terms}/test/`、itemSection/categoryText・videoSection/itemPeekの既存テスト             | 構成・戻る・規約・商品へのスクロール要求。async VideoTitleはBで確認             |
| U-S09               | `src/lib/test/formatRelativeTime.test.ts`・`sleep.test.ts`                                                                   | 時間境界、Date/ISO文字列、1499/1500ms                                           |
| C-N01、C-E01、C-O01 | `test/integration/components/item/itemConfirmPage/uploadButton/uploadButton.test.tsx`                                        | HTTP成功・7種HTTPエラー・通信/JSON障害・再試行、保留と再送・unmount後遷移の観測 |
| C-N02               | 同 `itemSection/itemSection.test.tsx`                                                                                        | 実共有部品のセール・画像・在庫/サイズ操作・null・説明開閉                       |
| C-N03               | 同 `videoSection/videoSection.test.tsx`                                                                                      | MP4/HLS/動画なし、概要開閉、保存日時・API抑止                                   |
| P-N01、P-N02        | `test/integration/pages/item/itemConfirmPage/confirm.test.tsx`                                                               | 両pageの送信、両側の在庫表示、関連null補完、長文の両説明開閉                    |
| B全ケース           | 同 `confirm.spec.ts`                                                                                                         | production SSR・認証・metadata・表示操作・画面幅・媒体・エラー・観測            |
| E全ケース           | ルート `test/E2E/item/itemConfirmPage/`                                                                                      | 実API/DBの作成・更新・取得・所有権・競合・再送                                  |

fixtureは単体専用の `src/app/item/confirm/test/fixtures.ts`、DOM結合の `test/fixtures/item/itemConfirmPage/{fixtures,setup}.ts`、ブラウザー専用の同 `browser*` に分離した。単体の編集IDは101、返却商品IDは501と異なる値で誤った遷移を検出する。DBのfixtureはIDを追跡してcleanupする。

## コマンドと静的検査

以下はPATHに `/home/conta/.nvm/versions/node/v22.22.2/bin` を優先して実行する。レポートの件数は最終ランナーの結果を根拠とし、途中の実行を重複加算しない。

```bash
# client/
npm run test:unit -- src/app/item/confirm src/app/item/itemSection/test src/app/item/videoSection/test src/components/container/test src/components/title-back/test src/components/terms/test src/lib/api/test/confirmClient.test.ts src/lib/api/test/confirmServer.test.ts src/lib/test/formatRelativeTime.test.ts src/lib/test/sleep.test.ts --maxWorkers=2 --reporter=json --outputFile=/tmp/item-confirm-unit-integrated.json
npm run test:integration -- test/integration/components/item/itemConfirmPage test/integration/pages/item/itemConfirmPage --maxWorkers=2 --reporter=json --outputFile=/tmp/item-confirm-integration.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
npm run build -- --webpack
```

| 検査                                          | 結果・根拠                                                                                                                                                                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| client全体lint                                | 失敗：23 errors / 37 warnings。`/tmp/item-confirm-lint-final.log`。既存commentText・profile/introductionのrender中ref参照、lp/profileの宣言前参照、Search/ShopSignupのeffect内state、共通APIのany等。テスト対象外も含み、本番未変更のため修正していない     |
| 今回変更したclientテスト・fixtureの個別ESLint | 成功。`/tmp/item-confirm-target-lint-final.log`。通常lintが対象とするTS/TSXに加えbrowserApi.mjs/browserStart.mjsも同じ設定で検査                                                                                                                            |
| client typecheck                              | build前は成功、build後の最終実行は失敗（既存ページのNext生成型49診断）。`/tmp/item-confirm-typecheck-final.log`。params/searchParamsがPromiseでない既存ページが原因。確認2ルートや追加テストの診断はない。現行tsconfigは `src/**/test` を除外せず結合も含む |
| client test専用tsconfig                       | 成功。`/tmp/item-confirm-test-typecheck-final.log`。単体・結合・fixture・Vitest/Playwright設定を明示収集                                                                                                                                                    |
| production build                              | `npm run build -- --webpack`成功。`/tmp/item-confirm-build-webpack.log`。型検査は既存Next設定でskipされるため別のtsc結果と区別。middleware/viewport等の既存警告あり                                                                                         |

WebKit専用のHTTPS API URLを指定した追加Webpack buildも成功（`/tmp/item-confirm-build-e2e-https.log`）。

通常Turbopack buildは制限内/外で進行せず中止し、設定変更なしでWebpack指定に切り替えた。HTTP待受・ブラウザー起動の制限は必要な実行を承認付きで再実行して切り分けた。

最終typecheckの失敗はbuildで生成された `.next/types` を収集したことで顕在化した。全体成功とは扱わず、対象外ページのparams/searchParamsをNextの非同期契約に合わせる修正を別途検討する。生成型を消したり除外して成功扱いにはしない。

初回実行のNode20ではVitestの収集・MSW周辺が正常動作しないため、Node22で再実行した。単体実装中のmockを返すbeforeEach、結合実装中のgetByRoleオプションexactの型診断はテスト側を修正済みで、本番不具合には数えない。ページ長文追補時のasync漏れによる収集失敗もテスト側で訂正して再実行した。初回に誤ってルートで実行したnpm test:integrationの失敗も機能結果へ含めない。

### ブラウザー結合の再現

production build後、client/で別々のターミナルから以下を起動する。テスト専用APIと署名用のfixture設定を利用し、既存運用サーバーへ向けない。

```bash
node test/fixtures/item/itemConfirmPage/browserApi.mjs
node test/fixtures/item/itemConfirmPage/browserStart.mjs
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3031 npm run test:pages:browser -- test/integration/pages/item/itemConfirmPage/confirm.spec.ts --workers=2 --trace=off --reporter=json > /tmp/item-confirm-browser-final.json
```

SSR GETはAPI4031、Nextは3031。未認証とサーバー認証切れ、詳細seller不一致、GET404/metadata単独401/404/500を別条件で実施する。認証fixtureを投入するため、ログインフォーム自体の検証ではない。

### E2Eの再現と保証範囲

server/.env.testのテスト用DB・認証設定、既存スキーマ、production buildと依存パッケージを用意する。fixtureはDB名がtest_dbであることと実接続先を検証し、マイグレーションは実行しない。

```bash
# リポジトリルート・別ターミナル
node test/fixtures/item/itemConfirmPage/startNext.mjs e2e
# test/
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3032 ITEM_CONFIRM_E2E_EXPRESS_URL=http://127.0.0.1:4042/api ITEM_CONFIRM_E2E_PROXY_URL=http://127.0.0.1:4043/api npm run test:e2e -- E2E/item/itemConfirmPage --workers=1 --trace=off --reporter=json > /tmp/item-confirm-e2e-final.json
npm run typecheck
# リポジトリルート：通常のclient lint収集範囲外のE2E TS/MJSを追加検査
node client/node_modules/eslint/bin/eslint.js --config client/eslint.config.mjs test/E2E/item/itemConfirmPage test/fixtures/item/itemConfirmPage
```

fixtureがケースごとに実ルーター・middleware・modelsを読み込む隔離Expressを4042、SSR転送を4043で起動する。通常のapplication cron startupは起動せず、S3/ジョブ処理のstubは追加していない。ローカルのメディアURLをseedし、実S3へのアップロード・変換自体を成功保証しない。ブラウザーの公開API通信はPlaywrightのHTTP transportで同じ実Expressへ転送して業務応答をそのまま返すため、本番CORS経路は対象外。

NextAuthのCSRF→credentials callback→session確認を通す実認証を使う。ユーザー・商品・動画・配送・セール・編集データをID限定で準備/cleanupし、他ユーザーの商品・関連行・マスターも不変を検証する。商品作成/更新時のフィールド対応、在庫currentのinitialへのリセット、編集元の消費、拒否時の部分保存なしまでassertする。

WebKitの追加再現は、productionのSecure Cookieを保つため以下のHTTPS構成を使う。opensslで一時証明書を生成し、テスト終了時に削除する。証明書エラーの許容はE2E fixtureに限定する。

```bash
# client/：WebKit向けHTTPS API URLをビルドへ固定（設定ファイル・本番コードは未変更）
NEXT_PUBLIC_API_URL=https://127.0.0.1:4042/api npm run build -- --webpack
# リポジトリルート・別ターミナル
ITEM_CONFIRM_E2E_TLS_URL=https://127.0.0.1:3042 node test/fixtures/item/itemConfirmPage/startNext.mjs e2e
# test/
PLAYWRIGHT_BASE_URL=https://127.0.0.1:3042 ITEM_CONFIRM_E2E_TLS_URL=https://127.0.0.1:3042 ITEM_CONFIRM_E2E_EXPRESS_URL=http://127.0.0.1:4042/api ITEM_CONFIRM_E2E_PROXY_URL=http://127.0.0.1:4043/api npm run test:e2e -- E2E/item/itemConfirmPage --project=e2e-webkit --workers=1 --trace=off --reporter=json > /tmp/item-confirm-e2e-webkit-https-api.json
```

HTTP環境のWebKit8失敗はSecureなaccess-tokenが保持されずPOST/PUTが未送信、直接要求試験もCookieなしで停止したもの。TLS導入後はCookie present=true/secure=trueとなったが、旧HTTP API URLへの混在コンテンツ遮断で送信前に停止した。HTTPS API URLの専用ビルドでこの環境差を解消して再実行し、22件成功を確認した（WebKitのCookie証跡はpresent=true/secure=true）。途中TLSではfixtureの証明書エラー許容がspec全体へ適用されないテスト側の不備もあり、共通のPlaywright optionへ移して訂正した。途中の混在コンテンツrunは14成功、3 unexpected（中断1件を含む）、未実行5件で停止しており、最終集計から除外する。Cookie値はレポート・証跡へ出さない。Next内部3032、TLS前段3042、実Express4042、SSR転送4043とし、ブラウザーHTTPS通信は実ExpressへHTTP transportで転送する。

E2E専用typecheckと追加ESLintは成功。ESLintのReact検出/pagesディレクトリの設定警告はあるが対象診断なし。根拠は `/tmp/item-confirm-e2e-typecheck.log`・`/tmp/item-confirm-e2e-lint.log`。PostgreSQLクライアントの並行query非推奨警告もあり、将来のpg更新への互換性は未保証。

ブラウザー動画fixtureの再実行は同じコマンドへ `--grep '元動画を実再生'` を追加し、`/tmp/item-confirm-browser-media-final.json` へ出力する。動画fixtureの再生成は `node test/fixtures/item/itemConfirmPage/browserMakeVideo.mjs`（Playwright Chromiumを使用）。

## 失敗・観測と修正案（提案のみ）

### F1：送信中・成功待機中の再送と複数遷移（C-O01）

両pageで同意後、MSW応答を保留して2回クリックするとPOST/PUTが2回届く。成功応答後にsleepを保留し、閉じる→再表示→送信しても2回目の要求が届き、unmount後に待機を解放すると同じ完了先へ2回pushする。これは現行の観測assertとして成功しており、二重送信防止の合格を意味しない。

原因はUploadButtonに送信状態・同期的な再入ガードがなく、成功から遷移まで操作が有効なこと。修正案は送信開始から遷移まで再入を防ぎ、送信ボタンと競合する編集操作を制御し、失敗時だけ再試行可能に戻すこと。unmount後の遷移を行うかも方針を確定し、キャンセル/無効化可能な待機と組み合わせる。バックエンドの重複・競合防止は別に確認し、フロントのdisabledだけで二重公開を防いだとしない。

契約確定後、元C-O01を「通信1回・通知1回・遷移1回」に変更して保留中/成功待機中を再検証する。観測履歴は本節に残す。本番コードの修正は今回行っていない。

### F2：ポップアップ・戻る操作のキーボード対応（B-O01、観測）

確認ポップアップはdivとクリック用Xアイコンで構成され、名前付きの閉じるbutton・dialog role・Escape処理・focus管理がない。Backもクリック用アイコンである。3ブラウザー×両ルートの6条件すべてで、最初のTabはポップアップ内に入らず、dialog/閉じるbuttonは0、Escapeで閉じず、クリックで閉じた後のfocus復帰もなかった。Backはrole=img、tabindex/aria-labelなし。画像拡大はSpaceで開いて閉じるbuttonのEnter後にfocus復帰することを確認した。現在の設計は観測としているため、未確定の要件を後付けして既存テスト失敗と数えない。

修正案は名前付きのdialogと閉じるbuttonを用い、開く時のfocus移動、閉じる時のfocus復帰、背景へのfocus逸脱防止、Escapeで閉じる方針を確定すること。Backも名前付きbuttonとしてキーボード到達・Enter/Space操作を可能にする。画像拡大の既存focus復帰は維持する。契約確定後、元B-O01で到達性・復帰・背景操作の抑止を通常assertへ移し、DOM結合でも回帰確認する。

### F3：全体静的検査の既存失敗（対象外・未修正）

build後のNext生成型で検出した49診断は、対象外ページが同期オブジェクトのparams/searchParamsを宣言していることによる。該当ページのPropsをPromise型にし、Page/generateMetadataなどの入口でawaitしてから参照する方針で修正・当該ページ回帰を行う。生成ファイル自体は編集しない。

lintの23エラーはrender中のref参照、変数の宣言前参照、effectでの同期state更新、anyなどに分類される。各元ファイルの責務に応じて描画データの算出・関数配置・型付けを見直し、ルール無効化で隠さない。今回追加したテストの検査は成功しており、無関係な本番修正やlint設定緩和は行っていない。

## 未確認範囲と完了の限界

- Node26、実S3アップロード/変換、本番CORS経路、全バックエンド異常分岐は今回の保証外。
- Oケースの同意保持・statusとURL不一致・再入・focus方針・性能閾値は未確定。観測を要件達成と同一視しない。
- HLSの依存呼出し・破棄は単体/DOMで検証し、実ブラウザーの再生はMP4で確認する。実HLSストリーム配信の互換性は未検証。
- 全体lintとbuild後typecheckに既存診断が残る。本番修正・ルール緩和・生成型削除は行っていない。
- レポートのID対応はテスト名だけでなくassert内容を照合した。実行結果の一時JSONが消えても件数・観測・再現手順が追えるよう本文に記録した。

自動テストだけでアクセシビリティ全般・体感性能・本番外部サービスや全バックエンド分岐を保証しない。今回の修正案は提案であり、不具合修正完了・再検証済みではない。
