# 商品アップロードAPI設計

## 主要DB

- item
    - item本体
- item_editing
    - itemアップロード（編集）中セッションテーブル
- item_draft
    - item下書き長期保存専用テーブル

---

## アップロード主要API

1. createItemEditing（itemEditing）

- フロント: /upload/before
- route: POST /item-editing
- usecase:
    - itemEditingテーブル作成
    - seller_id等固定データ入力

2. uploadItemEditConfirm

- フロント: /upload/[id]
- route: PUT /item-editing/:id
- usecase: 入力データ登録
    - 入力必須制約が必要

3. createItem

- フロント: /item/confirm/[id]
- route: POST /items
    - bodyにitemEditingId
- usecase:
    - itemテーブルを作成し、itemEditingからレコードをコピー
    - video作成、コピー
    - sale作成、コピー
    - itemShippingProfile作成、コピー
    - その他既存フローは継続

4. createItemDraft（下書き作成時のみ）

- フロント: /upload/[id]
- route: POST /item-draft
- usecase:
    - itemDraftテーブル作成
    - itemEditingテーブル削除
    - 入力データをitemDraftテーブルに登録

5. createItemEditingDraft（下書き商品ページから編集）

- フロント: /item/draft/[id]
- route: POST /item-editing/draft
    - bodyにitemDraftId
- usecase: itemEditingテーブルを作成し、itemDraftからコピー

6. createItemEditingCopy（販売中商品からのコピー出品）

- フロント: /item/[id]
- route: POST /item-editing/copy
    - bodyにitemId
- usecase: itemEditingテーブルを作成し、itemからコピー

7. deleteItemDraft（下書きitem削除）

- フロント: /item/draft/[id]
- route: DELETE /item-draft/:id
- usecase: itemDraftを削除
