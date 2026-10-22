# 下書き作成成功後に元の編集セッションが残る

発見日: 2026-10-22

## 問題と原因

`docs/design/backend/itemUpload.md` のcreateItemDraftは、下書き作成と同一transactionで元のitem_editingを削除する設計。
一方、現行 `server/src/usecases/itemDraft/createItemDraft.ts` は元行の再認可・ロック、下書き作成・画像保存を行うが、元行を削除していない。
成功後に編集セッションが残り、同じ編集IDから再度下書きを作成できる。今回の動画変換API追加とは別の既存の不一致。

## 修正方針・実装内容

- 基本設計の元行消費を適用し、下書きの保存と同一transaction内で、再認可済みの元item_editingを削除する。
- 失敗時の元行保持・作成先rollback、成功後の元行不存在、同時要求の行ロック後の再判定を検証する。
- 現行の保持を前提とした既存テスト・テスト設計・レポートを全文確認し、確定仕様との差を明示して更新する。

## 対象・参照

- `docs/design/backend/itemUpload.md`：createItemDraft。
- `server/src/usecases/itemDraft/createItemDraft.ts`
- `server/src/services/itemEditing/command.ts`：deleteItemEditing。
- `server/test/docs/architecture/itemDraft/createItemDraft.md`
- `server/test/docs/report/itemDraft/createItemDraft.md`
- `docs/todo/P1-bug/item-draft-convert-after-editing-deletion.md`（動画変換API接続の起点。完了後はdone配下を参照）。

## 注意事項

動画変換API追加作業では、元行の保持／削除は変更していない。下書き動画変換は作成APIが返すitemDraftIdを使用するため、元行消費の有無に依存させない。
