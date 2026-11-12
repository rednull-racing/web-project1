# 商品一覧共通枠・タブ 単体テストレポート

## 最新結果

2026-11-12、Node.js26.12.1 / Vitest5.0.5。対象4ファイルの単体29件すべて成功。失敗・pending/skip・todo・未処理例外0。設計15 IDは全実装・実行済み、未実装・未実行・中断0（自動ケース）。人間観測O01は未実行・人間確認待ち。本番コード変更なし。カバレッジ未取得。

[設計書](../../architecture/item-list/common.md)に対応。本文パスはclient基準。成果物は設計書、本レポート、`src/app/item-list/test/` の4テストとリポジトリルート `docs/log_memo/codex_log.md`。

## 検証境界と結果

ItemListUI/ItemListHeaderUIは実処理、barrelのContainer・TitleAndBack・Backだけ薄いDOMモックにし、子の包含・順序・Propsを確認。HTML風titleは同一文字列が子へ渡る契約を確認し、実TitleAndBackのXSS耐性全体を保証したとは扱わない。layoutは実処理、ToastBoundaryだけ置換し、子の同一性と再描画を確認。TabHeaderは実処理・実CSS Modules、Next routerのみ置換し、pushのURL・回数とactiveを確認。実Back操作・実トースト・実画面遷移は対象外。通信・DB・認証・SWR・時計は使用しない。

既存setupのDOM cleanup・mock clear/restoreを使用、操作はawaitしたuser-event。class生成名を固定せずimportしたstyles.activeを照合。結合・E2E・既存全単体回帰は今回対象外として未実行。

| テストファイル（`src/app/item-list/test/` 配下） | 実行 | 成功 | 失敗 |
| ------------------------------------------------ | ---- | ---- | ---- |
| `itemListHeaderUI.test.tsx`                      | 3    | 3    | 0    |
| `itemListUI.test.tsx`                            | 6    | 6    | 0    |
| `layout.test.tsx`                                | 3    | 3    | 0    |
| `tabHeader.test.tsx`                             | 17   | 17   | 0    |
| 合計                                             | 29   | 29   | 0    |

| 設計ID | 展開件数 | 判定 |
| ------ | -------- | ---- |
| U-H01  | 1        | 成功 |
| U-H02  | 1        | 成功 |
| U-H03  | 1        | 成功 |
| U-I01  | 3        | 成功 |
| U-I02  | 2        | 成功 |
| U-I03  | 1        | 成功 |
| U-L01  | 1        | 成功 |
| U-L02  | 1        | 成功 |
| U-L03  | 1        | 成功 |
| U-T01  | 1        | 成功 |
| U-T02  | 3        | 成功 |
| U-T03  | 9        | 成功 |
| U-T04  | 1        | 成功 |
| U-T05  | 2        | 成功 |
| U-T06  | 1        | 成功 |

枠は通常・空・複数children、通常・空・HTML風title、rerenderを確認。タブは3入力×3操作の全9通知、現在tab再クリック、Enter/Space、連続クリックと親再描画を確認し、ルーティングの状態変更を勝手に仮定していない。

## コマンド・集計根拠

client/で `PATH=/home/conta/.nvm/versions/node/v26.12.1/bin:$PATH` を各コマンドの先頭に指定。

```bash
npm run test:unit -- src/app/item-list/test/ --reporter=default --reporter=json --outputFile.json=/tmp/common-unit.json
./node_modules/.bin/eslint src/app/item-list/test/
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
npm run lint
npm run typecheck
```

| 検査         | 結果                                           | 根拠（一時成果物）                              |
| ------------ | ---------------------------------------------- | ----------------------------------------------- |
| 対象Vitest   | 成功、4ファイル29件                            | `/tmp/common-unit.json`、`/tmp/common-unit.log` |
| 対象eslint   | 成功、診断0                                    | `/tmp/common-target-lint.log`                   |
| テスト型検査 | 成功、診断0                                    | `/tmp/common-test-types.log`                    |
| 全体lint     | 失敗、23 errors・34 warnings（対象外）         | `/tmp/common-lint.log`                          |
| 本番型検査   | 失敗、既存の生成型とページの不整合等（対象外） | `/tmp/common-types.log`                         |

実ファイルごとのassertionResultsで集計し、describeや担当実行との重複加算はない。枠3ファイルの先行12件成功→タブ担当17件成功→統合29件成功を確認。初回失敗なし。新変更や未解決の対象診断がないため反復検証は終了した。

本番tsconfigはsrc内テストも含む。テスト用tsconfigは単体・結合・テスト設定も含む。通常lintは対象TSXを含み、追加の対象外TSはない。対象の診断0と全体成功を区別する。

## 修正案・残件

対象4ファイルの失敗はなく、本番修正・仕様変更・テスト期待値変更は不要。layoutのchildrenの明示型追加等、テスト成功に不要な変更は行っていない。

F1（対象外・提案のみ）：全体lintのrefs/render参照、effect内setState、宣言前参照、any等と、本番型検査の同期params/searchParamsとNext生成型の不整合、upload/okのItem.seller_id不存在は既存課題。適切な型・責務へ個別修正し、生成型を確認する。ルールの無効化で通さない。既存Todo `docs/todo/P3-techdebt/{restore-client-lint-baseline,align-next-page-params-generated-types}.md`（リポジトリルート基準）を参照。今回の本番変更範囲外として実行しない。

O01：担当「人間」、状態「人間確認待ち」。設計書に記載した幅・環境で配置、active・フォーカスの見え方、実遷移・戻る、トースト位置を確認する。結果受領前は自動成功件数に含めない。

単体の実装・実行・結果記録は完了。アプリ全体の静的検査成功や実画面確認まで完了とはしない。
