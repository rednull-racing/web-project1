# createItemEditingCopy詳細設計の認可対象表記を統一する

完了: 2026-10-14。第2章をItem所有者に修正し、第3章にItemDraftを使用しないことを明記。実装もItemの所有者条件を使用していることを確認済み。

## 問題の概要・原因

詳細設計の第2章には「ItemDraft所有者のみ」と記載されているが、第3章の認可処理と第6章の取得条件は `itemId` と `item.seller_id` を使用している。
コピー元を販売中のitemとする説明の中に、下書きの所有者を示す表記が残っている。

## 対象・参照ファイル

- `docs/design/backend/detail/itemEditing/createItemEditingCopy.md`
- `server/src/usecases/itemEditing/createItemEditingCopy.ts`
- `server/src/services/items/query/relation.ts`

## 修正方針・実装内容

docs配下のAGENTS.mdを確認し、第2章の認可対象を第3章・第6章の商品所有者条件と揃える。

## 実装時の注意事項

本番実装は第3章の条件に準拠している。認可処理やAPIの挙動を変更しない。
