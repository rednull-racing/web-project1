# 商品編集セッションの新規作成で使用するModelを修正する

## 問題の概要・原因

`POST /item-editing` のService `createItemEditing` が `ItemEditing.create` ではなく `Item.create` を呼んでいる。
編集セッションを作成するAPIから商品テーブルへの作成が行われる。

## 対象・参照ファイル

- `server/src/services/itemEditing/command.ts`
- `server/src/usecases/itemEditing/createItemEditing.ts`
- `server/src/controllers/itemEditing.ts`
- `server/src/models/item_editing.ts`
- `server/src/models/item.ts`

## 修正方針・実装内容

関連AGENTS.mdとバックエンド規約を確認し、`createItemEditing` が編集セッションのModelへ保存するよう修正する。
戻り値のIDが `item_editing.id` になることと、既存の呼び出し元への影響を確認する。

## 実装時の注意事項

`createItemEditingCopy` と `createItemEditingDraft` は今回の問題の修正対象に含めない。
Modelの制約やDBスキーマを変更せず、lintと型チェックを実行する。
