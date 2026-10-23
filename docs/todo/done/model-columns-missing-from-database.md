# Modelに存在して実DB・test_dbに存在しない列の整合方針を決める

## 2026-10-22 完了: 列不存在として検出した2属性の整合完了

ユーザーがpaid_info_id→orders_idの改名と、transfer.account_idの関連付け削除を指定。両DBへmigration適用し、全738属性の列存在・NULL制約一致を確認。transfer_idは誤記との回答により保持。
詳細は[今回の結果](../../log_memo/20261022-report-transfer-alignment.md)。以下の未完了・残件記載は対応前の履歴。NULL以外のFK削除動作差異は別Todoで管理する。

発見日: 2026-10-22。優先度: P3-techdebt。

## 問題と確認済みの原因

全ModelのNULL制約調査で、以下の実効属性がneondb/public・test_db/publicの両方に存在しないことを確認した。

- item_buyer_report.orders_id: Modelに明示定義されたINTEGER、allowNull:false。DBにはModelの対応属性がないpaid_info_idが存在する。
- transfer.account_id: BankAccount.hasOne(Transfer)の関連付けによって生成されたINTEGER、実効allowNull:true。

列の改名履歴や既存データの移行元・対応関係は未確定。NULL制約変更では解消できないため今回列追加は行わなかった。

## 対象・参照

- server/src/models/item_buyer_report.ts、orders.ts、bank_account.ts、transfer.ts、index.ts
- server/migrations/とDB設計・利用API
- docs/log_memo/20261022-all-column-nullability.md

## 修正方針・実装内容

列の意図と参照するAPI、既存migration履歴、両DBの定義・既存行を確認する。
orders_idとpaid_info_idの対応を推測せず、移行元とFKの設計を確定する。
Modelを正とするか既存DBを正とするか今回のNULL制約整合とは別に確認し、列追加・改名・関連付け修正の範囲を決める。
必要なら新規ESM migrationのup/downと既存行移行・復旧を設計し、許可された両DBへ反映して関連APIを検証する。
既存列の削除・データ補完・syncを独断で行わない。
