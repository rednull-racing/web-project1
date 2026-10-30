# Next.js生成型と既存ページparams型の整合

発見日: 2026-10-30 / 優先度: P3-techdebt

## 問題と原因

client/でproduction build後に `npm run typecheck` を実行すると53件のTS2344が発生する。`.next/types` のPagePropsはparamsをPromiseとして要求するが、既存の編集/商品/ショップ等のページは同期 `{ id: string }` 等で宣言している。メタデータ専用API接続前の2026-10-29レポートにも同じ53診断を記録済み。今回変更したitem/draft/[id]/page.tsxはPromise型で診断なし。

## 修正方針・対象

client/の本番typecheck全出力から対象ページを洗い出し、各AGENTS.mdと実呼出しを確認してNext.js App Routerの非同期params契約へ合わせる。例は `src/app/edit/account/shop/[id]/page.tsx`、`src/app/item/[id]/page.tsx` 等。生成 `.next/types` 自体は編集しない。共有設定のignore/型アサーションで診断を隠さない。

## 実装内容と完了条件

ページ・generateMetadata・共通コンポーネントの入力境界を調査し、必要なawaitと型を整合させる。該当ページの認証・取得・ルーティングが維持されることを検証し、client本番/テストtypecheck・lint・buildを実行する。メタデータAPI実装の範囲外として本タスクでは変更しない。

## 参照

- client/test/docs/report/item/itemDraftPage.md
- client/tsconfig.json・client/next.config.ts（実ファイル名を確認）
- 再現コマンド: client/で `npm run build -- --webpack` → `npm run typecheck`。2026-10-30の一時出力 `/tmp/item-draft-metadata-client-types.log`。
