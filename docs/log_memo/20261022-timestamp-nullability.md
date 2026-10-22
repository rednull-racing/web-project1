# createdAt / updatedAt NULL制約調査・適用結果

実施日: 2026-10-22。今回の対象は全ModelのcreatedAt / updatedAtのみ。その他の列は元Todoの残件。

## 調査と実行結果

- 関連付け設定後の83モデルの実効属性を調査。日時属性がある60テーブル120列を照合し、列不存在0件。残る23モデルには対象属性がない。
- .env由来neondb、.env.test由来test_dbで接続前の設定DB名、接続後のcurrent_database()とpublicスキーマを確認。秘密値は記録していない。
- 両DBとも38テーブル76列がModelのallowNull:falseに対してNULL許容。逆方向の差異は0件。適用前の定義は両DBで同一だった。
- ユーザー指定により実DBのupdatedAt NULL計49件を各行のcreatedAtで補完。test_dbの補完は0件。createdAtのNULLは両DBとも0件。削除・現在時刻による補完なし。
- [新規migration](../../server/migrations/20261022100000-enforce-model-timestamps-not-null.js)を両DBへ適用。既存migrationとModelは未変更。
- 各DBのSequelizeMetaに今回名が1件。全120列のNOT NULL一致・NULL0件を再確認。全列の型/default、pg_constraint定義、pg_indexes定義は前後で一致。

## 適用と復旧

- Node.js 26.12.1を使用。通常CLIのESM互換性は別Todoのため、今回のESMだけをimportしupを直接呼ぶ専用実行を使用した。未適用migrationの一括実行なし。
- 接続先を検査後、外側transactionでSequelizeMetaをロック。queryInterfaceのtransactionを同じ外側transactionへ委譲し、補完・制約変更・履歴INSERTを一括commitした。
- migrationはテーブル名順にACCESS EXCLUSIVEロックを取得。lock_timeout 5秒、statement_timeout 60秒。失敗時は補完と制約変更を全体rollbackする。
- downは対象38テーブルの日時2列を逆順でDROP NOT NULLし、適用前のNULL制約へ戻す。型/default等は変更しない。
- 補完済み日時はdownでNULLへ戻さない。補完前の行IDを永続保存しておらず、データ復旧には別途バックアップ等が必要。実DB/test_dbへのdownは未実行。
- 通常CLIによる再適用・undoはESM互換性Todoの確認後に行う。直接undoする場合は対象名と接続先を確認し、downと対象履歴削除を同じtransactionに含める。

## 検証

- migration構文、npm run lint、npm run typecheck成功。
- test/integration/database/itemEditing/convertItemEditingVideo/database.test.ts: 13件成功。test_dbのみで実行。実DBへテスト行は作成していない。
- 今回は既存回帰とDBメタデータ比較を実施。76列それぞれに対する不正SQL投入やdown実行は未実施。

## 全対象列の比較

Modelは全列allowNull:false。表の「前」はDBのis_nullable。「後」は両DBともNO。NULL件数は適用前→適用後。

| テーブル | 列 | neondb 前 | test_db 前 | neondb NULL | test_db NULL | 両DB 後 |
| --- | --- | --- | --- | --- | --- | --- |
| address | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| address | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| bank_account | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| bank_account | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| blog | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| blog | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| cancel | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| cancel | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| cart | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| cart | updatedAt | YES | YES | 1 → 0 | 0 → 0 | NO |
| chat | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| chat | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| comment_like | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| comment_like | updatedAt | YES | YES | 12 → 0 | 0 → 0 | NO |
| comment_report | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| comment_report | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| comment | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| comment | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| coupon | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_user | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_user | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_item | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_item | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_shop | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_shop | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_category | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| coupon_category | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| delivery | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| delivery | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| follow | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| follow | updatedAt | YES | YES | 2 → 0 | 0 → 0 | NO |
| id_card | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| id_card | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| inquiry | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| inquiry | updatedAt | YES | YES | 2 → 0 | 0 → 0 | NO |
| item_buyer_report | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_buyer_report | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_deleted | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_deleted | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_delete_logs | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_delete_logs | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_draft | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item_draft | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item_editing | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item_editing | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item_like | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_like | updatedAt | YES | YES | 2 → 0 | 0 → 0 | NO |
| item_report | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_report | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_shipping_profile | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_shipping_profile | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| item_trash | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item_trash | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| item | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| journal | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| journal | updatedAt | YES | YES | 4 → 0 | 0 → 0 | NO |
| name | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| name | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| notification | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| notification | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| order_deleted | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| order_deleted | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| orders | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| orders | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| permit | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| permit | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| point_lots | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| point_lots | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| points_history | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| points_history | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| points_uriage_over | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| points_uriage_over | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| purchase_session | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| purchase_session | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| reference_code | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| reference_code | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| refresh_tokens | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| refresh_tokens | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| s3_metadata | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| s3_metadata | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| sale | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| sale | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| sales_history | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| sales_history | updatedAt | YES | YES | 15 → 0 | 0 → 0 | NO |
| search | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| search | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| search_words | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| search_words | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| shop_info_edit | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| shop_info_edit | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| shop_signup | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| shop_signup | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| shop_info | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| shop_info | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| star_history | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| star_history | updatedAt | YES | YES | 11 → 0 | 0 → 0 | NO |
| suggest_words | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| suggest_words | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| token_email_change | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| token_email_change | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| token_password_reset | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| token_password_reset | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| token_signup_verification | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| token_signup_verification | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| transfer | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| transfer | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| uriagekin_history | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| uriagekin_history | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| uriagekin_lots | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| uriagekin_lots | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| user | createdAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| user | updatedAt | NO | NO | 0 → 0 | 0 → 0 | NO |
| user_delete_logs | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| user_delete_logs | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| video | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| video | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| watch_history | createdAt | YES | YES | 0 → 0 | 0 → 0 | NO |
| watch_history | updatedAt | YES | YES | 0 → 0 | 0 → 0 | NO |
