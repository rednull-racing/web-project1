# 下書き作成成功後に元の編集セッションが残る

発見日: 2026-10-22

## 完了結果（2026-10-22）

- 下書き本体・画像の保存後、再認可・ロック済み元編集行を同じtransactionで削除するよう修正。
- 成功後の同ID再送404、削除失敗/実DELETE後のrollbackによる元行復元、同時要求の先行commit/rollback後再判定を検証。
- 単体/HTTP357件・実DB180件（計537件）、lint・両型検査・変更test TS追加lint・差分検査が成功。
- [テスト設計](../../../server/test/docs/architecture/itemDraft/createItemDraft.md)・[検証結果](../../../server/test/docs/report/itemDraft/createItemDraft.md)を更新。自作行限定cleanup・全3接続test_db確認とclose成功、migration実行なし。

以下は対応前の問題・修正方針の記録。

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
- `docs/todo/done/item-draft-convert-after-editing-deletion.md`（動画変換API接続の完了記録）。

## 注意事項

動画変換API追加作業の時点では、元行の保持／削除は変更していなかった。本Todoの修正で成功時の元行削除を適用した。下書き動画変換は作成APIが返すitemDraftIdを使用するため、元行消費の有無に依存させない。
