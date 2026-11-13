# 在庫一覧E2E

業務APIをモックせず実NextAuth・Express itemsルート・test_dbを接続する。
fixtures/item-list/stock/harness.tsは既存draft/backendHarness.tsを再利用するため、
item_draft/item_editingのschema guardとseedの前提も必要。

本人21件・他人1件・所有者null1件を専用IDで作成する。
本人の1件はattributes={}、1件は在庫0、残りは在庫1234。
同日時のID降順、20+1ページ、検索、所有権、未認証拒否と商品行の不変性を確認。
finallyで専用itemを削除した後に共有ハーネスがユーザー等を後片付けする。

test/README.mdに従いNextをproduction build/startする。
NEXT_PUBLIC_API_URLとAPI_URLはhttp://127.0.0.1:4333/api、
NEXTAUTH_URLとPLAYWRIGHT_BASE_URLはhttp://127.0.0.1:3032へ揃える。
NEXTAUTH_SECRETはserver/.env.testと一致させ、値を出力しない。
ITEM_DRAFT_E2E_EXPRESS_URL=http://127.0.0.1:4332/api、
ITEM_DRAFT_E2E_PROXY_URL=http://127.0.0.1:4333/apiを指定すると、
ハーネスがExpressとproxyを起動する。

実行はtestでnpm run test:e2e -- E2E/item-list/stock/getStockItemList/flow.spec.ts。
代表は --project e2e-chromium --grep E-N01 を追加する。
代表成功後に全3ブラウザーへ展開する。型検査はtestでnpm run typecheck。

HTTP環境ではWebKitがproductionのSecure access-tokenを利用できず401になる既知の制約がある。
Cookie注入・Secure無効化・認証モックで成功させない。HTTPSでの再検証は別途必要。
migration/syncや環境全体の初期化は実行しない。
