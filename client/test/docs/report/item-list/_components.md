# item-list 共通コンポーネント 単体テストレポート

## 最新結果：2026-11-12 F1修正後の再検証

F1の修正案を適用し、共通4部品・73テストを再実行して**73成功・失敗0**。F1は修正・再検証済み。U-P03の2条件とU-P13の1条件はいずれも成功し、U-P13の通知なしassertも完了した。設計34 IDの自動ケースは全実装・実行済み。未実装・未実行・中断・pending/skip/todo・未処理例外は今回の自動単体実行で各0。

今回変更したファイルは `src/app/item-list/_components/test/pagination.test.tsx`、[設計書](../../architecture/item-list/_components.md)、本レポート、リポジトリルートの `docs/log_memo/codex_log.md`。本番実装と他のテスト条件は維持した。F2の既存静的診断、指定Node.js26環境、O01～O03の人間確認は引き続き残件。単体成功と全検査成功を区別する。

### F1の適用内容と根拠

- 対応する元ケースIDはU-P03/U-P13を維持。幅768・currentPage=5・totalPages=10の期待列を `1,2,3,4,5,6,7,...,10` から `1,...,3,4,5,6,7,...,10` へ訂正した。
- 本番のdelta=2では周辺ページが3～7となる。`currentPage - delta > 2` が成立するため2は省略され、コンポーネント仕様の前後2件と一致する。ユーザー指示に従いこの現行仕様を正とし、設計書の根拠説明・期待値とテストの2箇所だけを揃えた。
- 767px側の期待値、他のID、重複防止・button属性・コールバック・active検証は維持。ケースの削除やskip、assert削除はない。旧失敗と提案時の内容は下記の初回履歴に残す。

### 今回の実行と集計

実行ディレクトリは `client/`。Node.js v22.22.2、既存Vitest 5.0.5を使用し、各コマンドの先頭に `PATH=/home/conta/.nvm/versions/node/v22.22.2/bin:$PATH` を指定。依存や共有設定の変更はない。

```bash
npm run test:unit -- src/app/item-list/_components/test/ --reporter=default --reporter=json --outputFile.json=/tmp/item-list-f1-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint src/app/item-list/_components/test/
```

| ファイル（`src/app/item-list/_components/test/` 配下） | 実行 | 成功 | 失敗 |
| --- | --- | --- | --- |
| `itemImage.test.tsx` | 9 | 9 | 0 |
| `itemPrice.test.tsx` | 16 | 16 | 0 |
| `pagination.test.tsx` | 27 | 27 | 0 |
| `searchField.test.tsx` | 21 | 21 | 0 |
| 合計 | 73 | 73 | 0 |

集計元は `/tmp/item-list-f1-results.json` の実ファイル4件のassertionResults、標準出力は `/tmp/item-list-f1-unit.log`（いずれも一時成果物）。初回実行と重複加算していない。ケース対応は初回表と同一で、U-P03を「2件成功」、U-P13を「1件成功」へ更新したものが現在の判定となる。他32 IDも今回の再実行ですべて成功。カバレッジは未取得。

| 静的検査 | 今回結果 | 根拠（一時ログ） |
| --- | --- | --- |
| 対象eslint | 成功、診断0 | `/tmp/item-list-f1-eslint.log` |
| テスト用型検査 | 成功、診断0 | `/tmp/item-list-f1-test-types.log` |
| 全体lint | 失敗、23 errors・34 warnings、対象テスト診断0 | `/tmp/item-list-f1-lint.log` |
| 本番型検査 | 失敗、50診断。前回と診断出力一致 | `/tmp/item-list-f1-types.log` |

全体lintと本番型検査はF2で記載した既存の対象外診断。今回も修正していない。モック・実処理・保証範囲は初回と同じで、next/imageのみ置換、Font Awesomeと対象本体は実物、通信・DBなし。目視観測O01～O03は今回も未実行・人間確認待ちで、自動成功件数に含めない。Node.js指定バージョン、SSR/Hydration、実レイアウト・実検索・実遷移は未確認。

---

## 初回実装・実行の履歴（2026-11-12、F1修正前）

以下の末尾までの記述・判定・「最新」「最終」「今回」は初回実行時点の履歴。71成功・2失敗やF1提案のみの記述は過去結果であり、現在は上記の再検証結果が優先する。

## 初回結果・範囲

実行日：2026-11-12。[設計書](../../architecture/item-list/_components.md)の自動単体34 IDを4ファイル・73テストに実装し、最終実行は**71成功・2失敗**。失敗はU-P03の768px条件とU-P13。人間観測O01～O03は未実行・人間確認待ち。未実装の自動ケース0、中断0、ランナーのpending/skip/todoと未処理例外は最終実行で各0。自動検証全体は未完了であり、成功扱いにはしない。

パスは原則 `client/` 基準。変更は `src/app/item-list/_components/test/` の4テスト、本レポート、リポジトリルート基準 `docs/log_memo/codex_log.md`。本番コード・CSS・共有設定・依存ライブラリ・設計書は変更していない。設計書中の「未実装・今回は未実行」は設計書作成時点の記録で、今回の結果は本レポートを参照する。

## 実行環境と再現コマンド

Node.js v22.22.2、Vitest 5.0.5、既存node_modulesを使用。package.json指定はNode.js >=26.12.1 <27であり、指定環境での再確認は未実行。既定ロケールはen-USで、今回の整数の桁区切りは設計書のja-JP期待値と一致した。ロケールのモックは行っていない。

実行ディレクトリはリポジトリルートの `client/`。各コマンドの先頭に `PATH=/home/conta/.nvm/versions/node/v22.22.2/bin:$PATH` を付けた。

```bash
npm run test:unit -- src/app/item-list/_components/test/ --reporter=default --reporter=json --outputFile.json=/tmp/item-list-components-results.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint src/app/item-list/_components/test/
```

集計根拠は最終Vitest JSON `/tmp/item-list-components-results.json` と出力 `/tmp/item-list-unit-final.log`（一時成果物）。実ファイル4件、展開されたassertionResults 73件から集計し、describeのsuite数や再実行を加算していない。カバレッジ未取得。

| テストファイル（すべて `src/app/item-list/_components/test/` 配下） | 実行 | 成功 | 失敗 |
| --- | --- | --- | --- |
| `itemImage.test.tsx` | 9 | 9 | 0 |
| `itemPrice.test.tsx` | 16 | 16 | 0 |
| `pagination.test.tsx` | 27 | 25 | 2 |
| `searchField.test.tsx` | 21 | 21 | 0 |
| 合計 | 73 | 71 | 2 |

## 設計IDとの対応

下表の件数は各IDを含むテスト数。U-R01とU-R07は同じ1テストで4値の独立表示を確認するため重複加算しない。

| 設計ID | 展開件数 | 判定 |
| --- | --- | --- |
| U-I01 | 1 | 成功 |
| U-I02 | 1 | 成功 |
| U-I03 | 6 | 成功 |
| U-I04 | 1 | 成功 |
| U-P01 | 3 | 成功 |
| U-P02 | 4 | 成功 |
| U-P03 | 2 | 成功1・失敗1 |
| U-P04 | 2 | 成功 |
| U-P05 | 2 | 成功 |
| U-P06 | 2 | 成功 |
| U-P07 | 1 | 成功 |
| U-P08 | 4 | 成功 |
| U-P09 | 2 | 成功 |
| U-P10 | 2 | 成功 |
| U-P11 | 1 | 成功 |
| U-P12 | 1 | 成功 |
| U-P13 | 1 | 成功0・失敗1 |
| U-R01 | 1 | 成功 |
| U-R02 | 4 | 成功 |
| U-R03 | 3 | 成功 |
| U-R04 | 3 | 成功 |
| U-R05 | 1 | 成功 |
| U-R06 | 3 | 成功 |
| U-R07 | 1 | 成功 |
| U-R08 | 1 | 成功 |
| U-S01 | 1 | 成功 |
| U-S02 | 1 | 成功 |
| U-S03 | 1 | 成功 |
| U-S04 | 1 | 成功 |
| U-S05 | 4 | 成功 |
| U-S06 | 4 | 成功 |
| U-S07 | 3 | 成功 |
| U-S08 | 4 | 成功 |
| U-S09 | 2 | 成功 |

画像は指定属性、空URL、6通りのSOLD条件、再描画を検証。価格は表示ゲート4通り、割引値-1/0/1、価格0/999/1000と再描画を検証。検索は制御値の変更候補を同期時点で記録し、空白を含む4条件のEnter／クリック、非送信キー、装飾、連続通知を検証。ページ番号は表示範囲、端点のdisabled、通知引数・回数、現在ページ維持、非操作の省略span、active更新を検証した。U-P13は幅変更後の列のassertで失敗し、その後の通知なしassertには未到達。

## 失敗と修正案

### F1：ページ番号列の設計期待値と本番仕様の不一致（提案のみ）

対応：U-P03（幅768のみ）、U-P13。入力はcurrentPage=5、totalPages=10、幅768。U-P13は幅767から768へ変えて同じpropsでrerenderする。

- 設計期待値：`1,2,3,4,5,6,7,...,10`
- 実結果：`1,...,3,4,5,6,7,...,10`
- 本番のdelta=2、周辺範囲は3～7。`currentPage - delta > 2` は `3 > 2` で成立し、2を省略する。コンポーネントAGENTSの「周辺ページの前後2件」と省略条件には本番実装が整合する。先の設計書に私が記載した期待値に誤りがあると判断する。
- 推奨案：設計書U-P03の768px期待列とU-P13の参照列を実仕様に合わせて訂正し、対応する2テストの期待値を変更する。その後Paginationと静的検査を再確認する。今回の依頼は設計に基づく実装・結果と修正案の記載であるため、期待値の変更は適用せず失敗を残した。
- もし「1ページだけ欠けるなら省略せず2を表示する」が意図した新仕様なら、本番の左省略・ページ生成を一体で変更し、右側の対称条件も設計する必要がある。これは現行契約変更であり、独断で修正しない。

### F2：全体静的検査の既存診断（提案のみ）

全体lintは23 errors / 34 warnings。対象テストの診断は0。既存のrefsのrender中参照、effect内同期setState、宣言前参照、any等が対象外ファイルにある。本番型検査では `.next/types` のPageProps制約と既存ページの同期params/searchParamsが不一致、`src/app/upload/ok/[id]/page.tsx:35` の `Item.seller_id` 不存在が検出された。新規テスト由来の型エラーは最終実行で0。

修正案：ページのparams/searchParamsを対応するNext.js契約に合わせて受け取り、生成型を再生成して確認する。seller_idはAPI返却型と利用先のどちらが正しいか確認して揃える。lintは各責務でref参照・effect・宣言順・型を修正する。共有設定やルールの無効化で通さない。対象外のため今回は修正していない。診断のあるファイルと件数は下記に保存する。

本番型診断（全件、エラー本文の共通原因は上記）：

```text
.next/types/app/edit/account/shop/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/account/shop/com-free/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/account/shop/signup/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/address/purchase/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/address/shop/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/address/shop/com-free/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/address/shop/signup/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/email/new-email/[token]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/purchase/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/shop/con-name/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/shop/con-name/com-free/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/shop/con-name/signup/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/shop/rep-name/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/shop/rep-name/com-free/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/name/shop/rep-name/signup/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/phone-number/delivery/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/phone-number/shop/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/shop/com-free/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/shop/com-free/confirm/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/shop/com-free/upload/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/shop/company-name/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/shop/option/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/edit/shop/other/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item-list/uploaded/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item/[id]/page.ts(41,31): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item/admin/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item/admin/[id]/page.ts(41,31): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item/deleted/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/item/deleted/[id]/page.ts(41,31): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/order/list/purchased/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/order/list/sold/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/profile/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/profile/[id]/page.ts(41,31): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/profile/admin/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/profile/admin/[id]/page.ts(41,31): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/report/comment/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/report/item/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/shop-signup/step2/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/shop-signup/step3/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/shop-signup/step4/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/shop-signup/step5/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/transfer/detail/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/upload/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/upload/edit/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/upload/ok/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/user-list/comment-like/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/user-list/follow/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
.next/types/app/user-list/item-like/[id]/page.ts(37,29): error TS2344: Type 'Props' does not satisfy the constraint 'PageProps'.
src/app/upload/ok/[id]/page.tsx(35,34): error TS2339: Property 'seller_id' does not exist on type 'Item'.
```

全体lintの診断位置（警告も含む）：

```text
src/app/edit/address/addressEditForm.tsx
  45:8  warning  React Hook useEffect has a missing dependency: 'handleZipSearch'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
src/app/global-error.tsx
  8:39  warning  'error' is defined but never used  @typescript-eslint/no-unused-vars
src/app/inquiry/form.tsx
  27:8  warning  React Hook useEffect has a missing dependency: 'router'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
src/app/item/commentSection/commentList.tsx
  48:63  warning  'revalidate' is defined but never used  @typescript-eslint/no-unused-vars
src/app/item/commentSection/commentSection.tsx
  41:14  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/item/commentSection/commentText.tsx
  38:24  error  Error: Cannot access refs during render
src/app/item/commentSection/commentText.tsx:38:24
  39:32  error  Error: Cannot access refs during render
src/app/item/commentSection/commentText.tsx:39:32
  39:43  error  Error: Cannot access refs during render
src/app/item/commentSection/commentText.tsx:39:43
src/app/item/commentSection/replyList.tsx
  30:29  error    Unexpected any. Specify a different type                                                                     @typescript-eslint/no-explicit-any
  33:22  warning  'err' is defined but never used                                                                              @typescript-eslint/no-unused-vars
  37:8   warning  React Hook useEffect has a missing dependency: 'sellerMe'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
src/app/item/sellerSection/urlText.tsx
  16:18  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/login/login-form.tsx
  53:18  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/login/reset-pw-mail/reset-form.tsx
  31:18  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/lp/itemList/lpItemList.tsx
  41:13  error    Error: Cannot access variable before it is declared
src/app/lp/itemList/lpItemList.tsx:41:13
src/app/lp/itemList/lpItemList.tsx:45:5
  53:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @typescript-eslint/no-unused-vars
  64:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @typescript-eslint/no-unused-vars
src/app/lp/shop/page.tsx
  9:6  warning  'Res' is defined but never used  @typescript-eslint/no-unused-vars
src/app/my-page/logout.tsx
  21:18  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/my-page/moneySection/moneySection.tsx
  1:10  warning  'IconAlertTriangle' is defined but never used  @typescript-eslint/no-unused-vars
src/app/my-page/referenceCode.tsx
  53:42  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/profile/adminSection.tsx
   3:10  warning  'getAccessToken' is defined but never used  @typescript-eslint/no-unused-vars
  39:22  warning  'err' is defined but never used             @typescript-eslint/no-unused-vars
src/app/profile/introduction.tsx
  29:24  error  Error: Cannot access refs during render
src/app/profile/introduction.tsx:29:24
  30:32  error  Error: Cannot access refs during render
src/app/profile/introduction.tsx:30:32
  30:43  error  Error: Cannot access refs during render
src/app/profile/introduction.tsx:30:43
src/app/profile/itemList.tsx
  45:13  error    Error: Cannot access variable before it is declared
src/app/profile/itemList.tsx:45:13
src/app/profile/itemList.tsx:49:5
  47:8   warning  React Hook useEffect has a missing dependency: 'setVL'. Either include it or remove the dependency array                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   react-hooks/exhaustive-deps
  57:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @typescript-eslint/no-unused-vars
  68:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            @typescript-eslint/no-unused-vars
src/app/search/itemList.tsx
  27:39  error    Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/search/itemList.tsx:27:39
  38:8   warning  React Hook useEffect has missing dependencies: 'isDesktop' and 'viewMode'. Either include them or remove the dependency array                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      react-hooks/exhaustive-deps
src/app/shop-signup/step2/form.tsx
  62:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/shop-signup/step2/form.tsx:62:13
  98:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/shop-signup/step2/form.tsx:98:13
src/app/shop-signup/stepBar.tsx
  16:9  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/shop-signup/stepBar.tsx:16:9
src/app/signup/verify/verify-form.tsx
  55:18  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/app/upload/attributes.tsx
  50:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/attributes.tsx:50:13
src/app/upload/brandInput.tsx
  45:13  error    Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/brandInput.tsx:45:13
  52:13  error    Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/brandInput.tsx:52:13
  90:28  warning  The ref value 'requestVersion.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy 'requestVersion.current' to a variable inside the effect, and use that variable in the cleanup function                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        react-hooks/exhaustive-deps
src/app/upload/category.tsx
  83:17  error    Error: Cannot access variable before it is declared
src/app/upload/category.tsx:83:17
src/app/upload/category.tsx:122:5
  88:8   warning  React Hook useEffect has missing dependencies: 'fetchLevel2' and 'onConstraintChange'. Either include them or remove the dependency array. If 'onConstraintChange' changes too often, find the parent component that defines it and wrap that definition in useCallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           react-hooks/exhaustive-deps
src/app/upload/condition.tsx
  25:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/condition.tsx:25:13
src/app/upload/shipping.tsx
  35:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/shipping.tsx:35:13
src/app/upload/videoInput.tsx
  33:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/videoInput.tsx:33:13
  42:13  error  Error: Calling setState synchronously within an effect can trigger cascading renders
src/app/upload/videoInput.tsx:42:13
src/components/header/searchInputMobile.tsx
  21:12  warning  'isFocused' is assigned a value but never used  @typescript-eslint/no-unused-vars
  44:18  warning  'err' is defined but never used                 @typescript-eslint/no-unused-vars
  57:18  warning  'err' is defined but never used                 @typescript-eslint/no-unused-vars
src/components/header/searchInputPC.tsx
  38:9   error    Error: Cannot access variable before it is declared
src/components/header/searchInputPC.tsx:38:9
src/components/header/searchInputPC.tsx:43:5
  48:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   @typescript-eslint/no-unused-vars
  61:18  warning  'err' is defined but never used                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   @typescript-eslint/no-unused-vars
src/components/star.tsx
  20:22  warning  'err' is defined but never used  @typescript-eslint/no-unused-vars
src/hooks/useInfinitePagination.ts
  16:27  warning  'size' is assigned a value but never used  @typescript-eslint/no-unused-vars
src/lib/api/server.ts
  18:14  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any
test/integration/pages/item/itemDraftPage/page.spec.ts
    8:9   warning  'request' is defined but never used  @typescript-eslint/no-unused-vars
  101:72  warning  'request' is defined but never used  @typescript-eslint/no-unused-vars
```

## 静的検査・境界・未確認

| コマンド | 最終結果 | 根拠（一時ログ） |
| --- | --- | --- |
| 対象Vitest | 失敗（71成功・2失敗） | `/tmp/item-list-unit-final.log`、上記JSON |
| `npm run lint` | 失敗（23 errors・34 warnings、すべて対象外） | `/tmp/item-list-lint-final.log` |
| `npm run typecheck` | 失敗（既存ページと生成型） | `/tmp/item-list-typecheck-final.log` |
| `tsc --noEmit -p test/tsconfig.json` | 成功 | `/tmp/item-list-test-typecheck-final.log`（診断なし） |
| 対象ディレクトリのeslint | 成功（診断なし） | `/tmp/item-list-target-lint-final.log` |

本番tsconfigは実ファイル上 `src/**/test` を除外していない。テスト用tsconfigは単体・結合とテスト設定類を明示的に含む。通常lintも対象TSXを含み、対象外TSへの追加検査は不要だった。

対象本体は実処理、next/imageのみDOM属性を受け渡すimgへ置換。Font Awesomeと条件付きCSS Modules classは実物。window.innerWidthは各ケースで元descriptorへ復元。通信・認証・DB・実ページ連携はなく、HTTP障害注入なし。共通setupによるcleanup、モック履歴リセットを使用した。画像最適化・読込、CSSレイアウト、SSR/Hydration、実検索・実遷移、指定Node.js26環境の保証はない。

O01（画像・価格の見え方）、O02（ページ操作の見え方）、O03（検索操作感・IME・アイコン到達性）は設計書の環境・手順に従い人間が確認する。すべて未実行・人間確認待ち。自動テスト未実装と区別する。結合・E2E・既存全単体回帰は対象外として未実行。

## 実行履歴と補正

- 初回にリポジトリルートでnpmを実行し、test:unitスクリプトがなく開始できなかった。後続の実行はclientで実施。集計に含めない。
- Node.js20.20.2ではundiciの初期化が失敗し、2ファイルのworker起動エラー、ケース本体0件。Node.js22へ切り替え、Image/Priceの25件が成功。指定Node.js26での確認は残件。
- 4ファイル初回統合は63成功・10失敗。同じ誤ったページ列の補助assertで別観点が停止していたため、列の不一致をU-P03/U-P13へ集約し、操作・active・省略spanのテストはその観点を独立して検証するよう整理。期待値の不一致を隠す変更はしていない。
- 統合後のテスト型検査でByRoleOptionsにない `exact` 指定6箇所を検出。文字列nameは完全一致が既定なので不要な指定を削除し、型検査成功。対象テストの不具合は修正済み。
- 最終実行は71成功・2失敗、未処理例外0。テスト名の条件表示を明確にした後にも同結果を確認。再実行の件数は合算していない。

残件はF1の契約・期待値の確定、F2の対象外静的診断、指定Node.js環境およびO01～O03の確認。依頼されたテスト実装・実行・修正案の記載は完了したが、全検証成功とはしない。
