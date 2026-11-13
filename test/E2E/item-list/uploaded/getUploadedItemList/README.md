# 出品一覧E2E

`fixtures/item-list/uploaded/harness.ts` は既存の `item-list/draft/backendHarness.ts` を再利用する。
NextAuth・Expressの本番itemsルート・test_dbを使用し、業務APIはモックしない。
fixtureは本人21件・他人1件・所有者null1件を作り、同じ出品日時でID降順を検証する。
Video/Saleは関連なし。検索対象のsearch_textは保存済み正規化文字列として投入する。
専用IDのitemだけをfinallyで削除してから、既存ハーネスがユーザー等を後片付けする。

事前に `test/README.md` に従って隔離DBとproduction Nextを準備する。
既存ハーネスの `ITEM_DRAFT_E2E_EXPRESS_URL` と `ITEM_DRAFT_E2E_PROXY_URL` はloopbackの異なるポートを明示する。
例: Express `http://127.0.0.1:4332/api`、proxy `http://127.0.0.1:4333/api`。
production build時のNEXT_PUBLIC_API_URLとNextAuth実行時API_URLは同じproxyへ接続させる。
Next起動先は `PLAYWRIGHT_BASE_URL` と一致させる。ハーネスがExpressとproxyを起動する。
マイグレーション・syncは実行しない。

```bash
cd test
ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4332/api ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4333/api npm run test:e2e -- E2E/item-list/uploaded/getUploadedItemList/flow.spec.ts --project e2e-chromium --grep E-N01
```

代表E-N01成功後にgrepを外し、Firefox/WebKitへ展開する。
既存ハーネスはitem_draft/item_editingのschema guardも要求するため、この前提が失敗すると全ケース本体は未到達になる。
本ケースが確認する一覧のDB不変性と、ログインに伴う認証テーブルの更新は区別する。
