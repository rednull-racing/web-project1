# 商品一覧共通枠・タブの単体テスト設計

## 対象・根拠・境界

パスはclient基準。対象は `src/app/item-list/{itemListUI,itemListHeaderUI,layout,tabHeader}.tsx`。根拠は各実装、[src規則](../../../../src/AGENTS.md)、[テスト規則](../../../AGENTS.md)、[設計規則](../AGENTS.md)。4ファイルは通信・DB・認証判断を持たず、子の配置とタブの遷移要求を担う。責務にないAPI失敗や所有権テストを追加しない。

- ItemListUI：Containerの中にTitleAndBack（受け取ったtitle）→children。
- ItemListHeaderUI：Containerの中にBack→children。戻り先urlを指定しない。
- ItemListLayout：ToastBoundaryでchildrenを包む。Toast表示処理はProvider側の責務。
- TabHeader：all/selling/soldの3ボタン。選択されたものだけactive。クリックは `/item-list/uploaded?tab=値` へrouter.pushする。自身でtabを変更しない。

単体のみを実装する。既存のBack/Containerの単体やdraftページ結合と役割を分け、実トースト、実ルーティング、SSR/Hydration、CSS描画を保証しない。結合・E2Eは今回対象外。仕様変更が必要なら実行せずレポートへ修正案を残す。

## 配置・fixture・モック

新規予定配置は `src/app/item-list/test/{itemListUI,itemListHeaderUI,layout,tabHeader}.test.tsx`。Vitest unit project・RTL/jsdom・user-eventと既存setupを使用。追加依存なし。

枠3件は子境界を薄いモックにし、Container/TitleAndBack/Back/ToastBoundaryの渡されたPropsとDOM包含・順序を検証する。barrelの無関係な実装は読み込まない。対象自身は実行。複数childrenは順序を持つp/button、空はnull、titleは通常・空・HTML風文字列を用意し文字列がHTMLとして実行されないことを確認する。

TabHeaderは実処理とCSS Modules、router.pushをvi.fnで置換。生成class名の直書き・内部state・snapshotに依存しない。setupのcleanupとモック復元に従い、ケースごとに新しいprops/履歴を用意。全操作はawaitする。通信・時計・SWRの準備は不要。

## ケース

Uは単体、I/H/L/Tは対象、Oは人間観測。P0は基本契約、P1は補完。列挙条件は独立テストへ展開し、ID数と実行件数を混同しない。

| ID・優先度 | 条件・手順 | 期待結果 |
| --- | --- | --- |
| U-I01 P0 | titleを通常/空/HTML風文字列にして描画 | titleをそのままTitleAndBackへ。Containerの中で見出しが子より先。HTML風入力はテキストで保持 |
| U-I02 P1 | childrenをnull／複数要素にする | タイトルを維持、余分な要素を追加せず子の順序・包含を保持。Containerへheader指定なし |
| U-I03 P1 | titleとchildrenをrerenderで更新 | 最新値だけを渡し、旧内容を残さない |
| U-H01 P0 | 複数childrenで描画 | Container内でBackが先、子の順序維持。Backへurl指定なし、Containerへheader指定なし |
| U-H02 P1 | null children | Backは1個維持、子の代替表示を追加しない |
| U-H03 P1 | children変更でrerender | 新しい内容へ置換、Backは重複しない |
| U-L01 P0 | 複数children | ToastBoundaryが同じchildrenを受け取り包含・順序を保持 |
| U-L02 P1 | null children | Boundaryを維持し余分な代替表示なし |
| U-L03 P1 | children変更でrerender | Boundary内は最新内容だけ。Provider自体のトースト設定は対象外 |
| U-T01 P0 | 初期描画 | nav内に全商品・販売中のみ・売り切れの3ボタン、この順序。type=button、name=all-tab/selling-tab/sold |
| U-T02 P0 | all/selling/sold | 指定tabだけactive、他は非active。全ボタン操作可能 |
| U-T03 P0 | 3種のtabそれぞれから3ボタンを個別クリック | 正確なURLへpush1回（現在tabの再クリックも通知）。親再描画までactiveは入力tabのまま |
| U-T04 P1 | all→soldにrerender | activeが移り旧active除去、pushは呼ばない |
| U-T05 P1 | ボタンにfocusしEnter/Space | 遷移要求1回。見た目や実遷移は確認しない |
| U-T06 P1 | 同じボタンを2回クリック | 2回push。操作を間引く新仕様を要求しない |

## 人間観測

O01：担当「人間」、状態「人間確認待ち」。ログイン済み、Chromium、幅375/768/1280、一覧のタイトル枠・出品一覧のタブが見える環境。枠とタブを閲覧しキーボードで移動する。タイトルと本文の間隔、activeの判別、フォーカス、実遷移・戻るとトーストの位置を観測する。結果記録は `test/docs/report/item-list/common.md`。自動成功へ含めない。

## 実行計画・完了条件

枠の代表正常系→入力差分、タブ表示→遷移要求の順で確認。import/setup失敗は同原因の依存ケースを保留し復旧後再開、独立ファイルは継続する。修正時は対象と影響範囲のみ再検証し、不必要な反復をしない。

client/で予定：

```bash
npm run test:unit -- src/app/item-list/test/
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint src/app/item-list/test/
```

通常lintは対象TSXを含む。本番tsconfigとテスト用のinclude/exclude差は実行時に確認する。設計IDとassert、配置・リンク・実行JSONの対応を確認し、未実装・未実行・失敗・中断をレポートで区別する。対象自動検証完了と、既存全体診断・O01の残件を分ける。
