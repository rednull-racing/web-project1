# フロントエンドのlintを通る状態へ戻す

発見日: 2026-10-22 / 優先度: P3-techdebt

## 問題と原因

`cd client && npm run lint` が29エラー・40警告で失敗する。
Node.js 20.20.2と26.12.1でESLintのJSON出力が完全一致し、Node.js更新に依存しない。
Reactのrefs・set-state-in-effect・immutability規則、明示的anyなど既存コードの違反がある。

## 修正方針・実装内容

ESLintの指摘を再取得し、各ファイルに適用される規約を読んで個別に修正する。
ルール無効化で隠さず、表示やイベント処理の挙動を維持する。
lint・typecheck・buildを確認し、必要な画面動作を検証する。

## 対象・参照

- `client/eslint.config.mjs`（実ファイル名は作業時に確認）
- `client/src/app/item/commentSection/commentText.tsx`、`replyList.tsx`
- `client/src/components/header/searchInputPC.tsx`
- `client/src/lib/api/server.ts`
- その他の対象はlintの全出力を参照する。

## 注意事項

Node.js更新作業では修正対象外とし、既存のlint違反として記録した。

## 2026-10-23 再確認

createItemEditingCopyのstatusクエリ対応時もclient全体lintは29エラー・36警告で失敗した。変更したcopyUpload.tsとsellerSection/uploadButton.tsxの個別lintは成功。既存のrefs・set-state-in-effect・immutability・anyの違反は今回の修正範囲外として維持する。

## 2026-10-29 getItemDraftPage型整合時の再確認

Node.js 22.22.2で全体ESLintは23エラー・37警告。変更7 TS/TSXの個別lintは成功し、本番・テスト型検査も成功。既存のrefs・immutability・any等は今回の範囲外として保持。今回実行した全体lintの一時出力は `/tmp/item-draft-client-lint.log`。

## 2026-10-30 メタデータAPI接続時の再確認

Node22.22.2で全体lintは既存23 errors/37 warnings。今回のpage.tsx・server.ts・server.test.ts・apiServer.ts・page.spec.tsの個別lintは0 errors/既存2 warnings。本API接続の範囲外として保持。結果はclient/test/docs/report/item/itemDraftPage.mdへ記録する。

## 2026-11-13 仕様を変えない範囲の修正

今回の依頼では仕様に影響する修正を行わない。未使用のimport・変数・catch引数の削除、返信一覧レスポンスの型指定、NextAuth既存型の利用、検索履歴取得関数のeffect内への移動を実施した。ESLint設定・抑制コメントは変更していない。

`npm run lint` は23エラー・34警告から20エラー・7警告へ減少した。残件は以下。依存配列の変更、初期化・同期処理の移動、DOM測定方法の変更は表示・通信・更新タイミングへの影響確認が必要なため保持する。今後の修正では親から渡される値・関数の安定性、初回表示、画面幅、入力・再取得・非同期応答を確認し、必要な仕様判断を先に確定する。

| ファイル（client/基準） | 残るルール・行 |
| --- | --- |
| `src/app/edit/address/addressEditForm.tsx` | react-hooks/exhaustive-deps: 45 |
| `src/app/inquiry/form.tsx` | react-hooks/exhaustive-deps: 27 |
| `src/app/item/commentSection/commentText.tsx` | react-hooks/refs: 38, 39 |
| `src/app/item/commentSection/replyList.tsx` | react-hooks/exhaustive-deps: 37 |
| `src/app/lp/itemList/lpItemList.tsx` | react-hooks/immutability: 41 |
| `src/app/profile/introduction.tsx` | react-hooks/refs: 29, 30 |
| `src/app/profile/itemList.tsx` | react-hooks/immutability: 45 / react-hooks/exhaustive-deps: 47 |
| `src/app/search/itemList.tsx` | react-hooks/set-state-in-effect: 27 / react-hooks/exhaustive-deps: 38 |
| `src/app/shop-signup/step2/form.tsx` | react-hooks/set-state-in-effect: 62, 98 |
| `src/app/shop-signup/stepBar.tsx` | react-hooks/set-state-in-effect: 16 |
| `src/app/upload/attributes.tsx` | react-hooks/set-state-in-effect: 50 |
| `src/app/upload/brandInput.tsx` | react-hooks/set-state-in-effect: 45, 52 / react-hooks/exhaustive-deps: 90 |
| `src/app/upload/category.tsx` | react-hooks/immutability: 83 / react-hooks/exhaustive-deps: 88 |
| `src/app/upload/condition.tsx` | react-hooks/set-state-in-effect: 25 |
| `src/app/upload/shipping.tsx` | react-hooks/set-state-in-effect: 35 |
| `src/app/upload/videoInput.tsx` | react-hooks/set-state-in-effect: 33, 42 |

検証: `npm run test:unit -- src/lib/api/test/confirmServer.test.ts src/lib/api/test/confirmClient.test.ts` は2ファイル16件成功（HTTP・認証の依存はモック）。`npm run typecheck` は既存の `.next/types` のparams型不整合（関連Todo: [align-next-page-params-generated-types.md](align-next-page-params-generated-types.md)）と `src/app/upload/ok/[id]/page.tsx:35` の `Item.seller_id` 未定義で失敗。後者は今回変更していない型とページの不整合で、所有者判定に関わるため実レスポンスと認可契約を確認して別途修正する。ブラウザー動作・buildは未実施。lint全通過には至らないため本Todoは未完了として残す。

## 2026-11-13 profile/itemListの追加修正

`client/src/app/profile/itemList.tsx` の表示件数を遅延初期化し、初回モバイル取得をeffect内の非同期関数へ移した。マウント時のuserIdをrefに保持し、従来の初回だけの取得を維持する。対象eslintは0エラー・0警告（上表のprofile/itemListの残件は解消）。全体lintは対象外の3エラー・1警告で失敗し、本Todoは未完了。typecheckは既存のparams型不整合とupload/okのseller_id型エラーで失敗し、対象ファイルの診断はない。build・ブラウザー操作確認は未実施。

## 2026-11-13 search/itemListの追加修正

`client/src/app/search/itemList.tsx` の初回effectを除去し、画面幅はstateの遅延初期化で判定する。従来はeffectが初期値isDesktop=false・viewMode=videoを参照し、全画面幅でlimit=6になり、その後のモード切り替えでも変化しなかった。この実挙動を維持してlimit=6に固定し、初期値36から6への切り替えによる余分なAPIキー変更を除去した。PC動画18件・商品36件等への変更は行っていない。画面幅の再判定も従来どおりリサイズでは行わない。

対象eslintは0エラー・0警告（上表のsearch/itemListの残件は解消）。全体lint・typecheckには対象外の既存エラーが残る。build・ブラウザー操作確認・自動テストは未実施。本Todoは他ファイルの残件があるため未完了。

## 2026-11-13 brandInput・categoryの追加修正

依頼対象2ファイルのeffect内同期state更新を整理し、対象・client全体のlintが指摘0件で成功した。ブランド検索・カテゴリー初期化と応答競合の単体テスト20件、テスト用型検査も成功。詳細は `client/test/docs/report/upload/itemUpload.md` 第13節。過去の残件表は各修正前の履歴であり、現在のlint残件を示さない。

本番typecheckは既存params型不整合とupload/okのseller_id型エラーで失敗し、build・人間目視は今回未実施。lint違反の解消は完了したが、本Todoの検証項目すべての完了とはせず、型エラーと未確認事項を残す。
