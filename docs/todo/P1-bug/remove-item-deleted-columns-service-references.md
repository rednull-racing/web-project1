# 削除済み商品カラムのService参照を整理する

優先度: P1-bug

## 問題と原因

20261020120909のmigrationでitem.deleted_atとitem_editing/item_draft.item_idを削除済み。
Modelと作成用の型・コピー値は追従済みだが、Serviceの明示的なSQL条件や取得列に旧カラムが残っている。
対象APIやcronを実行すると存在しない列への参照で失敗する。

## 対象ファイル

- server/src/services/itemDraft/query.ts: getMyItemDraftのattributesにitem_idが残る。
- server/src/services/items/query/relation.ts: getMyItemWithVideoSaleShippingのwhereにdeleted_atが残る。
- server/src/services/items/command/update.ts: deleted_atの更新が残る。
- server/src/services/items/command/delete.ts: deleted_atによる論理削除が残る。
- server/src/services/items/query/cron.ts: deleted_atによる期限検索が残る。

## 修正方針・実装内容

明示的な取得列から削除済みカラムを除外し、関連単体テストの期待値を更新する。
削除・復元・期限削除については現在のitem_trash設計と呼び出し元を確認し、移行先の業務仕様を確定してから修正する。
単純に期限条件を削除して全商品を削除対象にしてはいけない。
本番コードの旧カラム参照を検索し、認可・所有権・transactionを維持して関連テストとlint/typecheckを実行する。
