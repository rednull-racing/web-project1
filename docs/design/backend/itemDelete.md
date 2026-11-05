# 商品削除API設計

## 主要DB

- item
    - item本体
- item_trash
    - 論理削除item
- item_deleted
    - 完全削除item概要
- item_delete_logs
    - 商品削除ログ

---

## API基本設計

### createItemDeleted（item論理削除・item_deleted作成）

- フロント: /item/[id]
- route: POST /item-deleted
- usecase: 
    - transaction
        - item取得
        - item_deletedテーブル作成
        - item関連テーブル削除
        - itemテーブル削除
    - お知らせ作成（非同期）

- 認可:
    - item.seller_id === userId

- 失敗時:
    - DB変更をrollback
    - itemは保持
