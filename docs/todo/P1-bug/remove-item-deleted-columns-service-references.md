# 商品アーカイブ処理をitem_trashへ移行する

優先度: P1-bug

## 問題と原因

20261020120909のmigrationでitem.deleted_atとitem_editing/item_draft.item_idを削除済み。
2026-10-20の対応でserver/srcの旧カラム参照を除去した。
ユーザー回答により、旧論理削除・復元APIは503・ITEM_ARCHIVE_UNAVAILABLEで停止し、30日削除cronの登録・旧実装も削除した。
item_trash移行は別対応のため、現在この3機能は利用できない。

## 対象・参照ファイル

- server/src/usecases/items/delete/logicalDelete.ts
- server/src/usecases/items/restore/restore.ts
- server/src/models/item_trash.ts
- server/src/models/item.ts
- server/src/cron/index.ts
- server/src/routes/items.ts
- server/src/usecases/items/delete/perfectDelete.ts

## 修正方針・実装内容

item_trashを使う削除・復元・期限削除の業務仕様を確定してから実装する。
商品本体を残すか、関連動画・セール・配送情報をどのように保持・復元するか、期限の起点と削除対象を決める。
取引中の削除拒否、所有権、関連データ・通知・削除ログ、transactionと並行実行を確認する。
ItemTrash.item_idのON DELETE CASCADEによる影響も確認し、商品削除でアーカイブを失わない構成にする。
復元・期限削除までテストしてから停止中APIを再開し、新cronを登録する。
期限条件のないItem全件取得や、旧deleted_atへの依存を再導入してはいけない。
