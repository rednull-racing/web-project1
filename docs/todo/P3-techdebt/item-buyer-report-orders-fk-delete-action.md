# ItemBuyerReportのorders外部キー削除動作をModelと照合する

発見日: 2026-10-22。優先度: P3-techdebt。

## 問題と確認済みの原因

paid_info_idからorders_idへのリネーム時、両DBの既存orders外部キーはON UPDATE CASCADE・ON DELETE NO ACTIONである一方、ModelはonDelete:CASCADEを指定していることを確認した。
今回のユーザー指示はカラム名変更とTransferの架空関連付け削除であり、FKの削除動作は変更せず保持した。

## 対象・参照

- server/src/models/item_buyer_report.ts、orders.ts
- server/migrations/20261022130000-rename-item-buyer-report-orders-id.js
- docs/log_memo/20261022-report-transfer-alignment.md

## 修正方針・実装内容

注文削除時に報告も削除するか保持するか、業務仕様・削除API・保存期間と照合する。
今回のNULL制約整合をFKの削除動作変更の許可に拡張せず、方針を確定して必要なModel修正または新規migrationを作成する。
DB変更する場合は対象と許可を確認し、実DBの既存報告を削除せず、test_dbの自作データで削除動作と復旧を検証する。
