# 商品リストAPI設計

## 主要DB

- item
    - item本体
- item_draft
    - 下書き商品
- item_trash
    - 論理削除item
- cart
    - カート
- watch_history
    - 消費閲覧履歴
- item_like
    - 高評価した商品

---

## API基本設計

### getItemTrashList（削除商品リスト取得）

- フロント: /item-list/trash
- route: GET /item-trash/list
- usecase: queryで指定の条件でitem_trashの一覧を取得

- 認可:
    - item_trash.seller_id === userId

### getItemDraftList（下書き商品リスト取得）

- フロント: /item-list/draft
- route: GET /item-draft/list
- usecase: queryで指定の条件でitem_draftの一覧を取得

- 認可:
    - item_draft.seller_id === userId

### getUploadedItemList（出品した商品リスト取得）

- フロント: /item-list/uploaded
- route: GET /items/list/uploaded
- usecase: queryで指定の条件でitemの一覧を取得

- 認可:
    - item.seller_id === userId

### getUploadedItemList（在庫付き出品した商品リスト取得）

- フロント: /item-list/stock
- route: GET /items/list/stock
- usecase: queryで指定の条件でitemの一覧を取得

- 認可:
    - item.seller_id === userId
