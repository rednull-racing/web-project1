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

### createItemEditing（itemEditing）

- フロント: /upload/before
- route: POST /item-editing
- usecase:
    - itemEditingテーブル作成
    - seller_id等固定データ入力

### uploadItemEditConfirm

- フロント: /upload/[id]
- route: PUT /item-editing/:id
- usecase: 入力データ登録

- 認可:
    - itemEditing.seller_id === userId

- 事前条件:
    - 入力データがそろってる必要（bodyでチェック）

### createItem

- フロント: /item/confirm/[id]
- route: POST /items
    - bodyにitemEditingId
- usecase:
    - itemテーブルを作成し、itemEditingからレコードをコピー
    - video作成、コピー
    - sale作成、コピー
    - itemShippingProfile作成、コピー
    - その他既存フローは継続

- 認可:
    - itemEditing.seller_id === userId

- 事前条件:
    - 公開必須項目がすべて存在する
    - video等の必須関連データが存在する

- transaction:
    - item
    - video
    - sale
    - itemShippingProfile
    - その他関連レコード
      → 全て同一Transaction

- 成功後:
    - itemEditing削除

- 失敗時:
    - DB変更をrollback
    - itemEditingは保持

### createItemDraft（下書き作成時のみ）

- フロント: /upload/[id]
- route: POST /item-draft
- usecase:
    - itemDraftテーブル作成
    - itemEditingテーブル削除
    - 入力データをitemDraftテーブルに登録

- 認可:
    - itemEditing.seller_id === userId

- 成功後:
    - itemEditing削除

- 失敗時:
    - itemEditingは保持

### createItemEditingDraft（下書き商品ページから編集）

- フロント: /item/draft/[id]
- route: POST /item-editing/draft
    - bodyにitemDraftId
- usecase: itemEditingテーブルを作成し、itemDraftから内容をすべてコピー

- 認可:
    - itemDraft.seller_id === userId

- 成功後:
    - itemDraft削除

- 失敗時:
    - itemDraftは保持

### createItemEditingCopy（販売中商品からのコピー出品）

- フロント: /item/[id]
- route: POST /item-editing/copy
    - queryにstatus（"normal" | "edit"）
    - bodyにitemId
- usecase: itemEditingテーブルを作成し、itemからコピー

- 認可:
    - item.seller_id === userId

### deleteItemDraft（下書きitem削除）

- フロント: /item/draft/[id]
- route: DELETE /item-draft/:id
- usecase: itemDraftを削除

- 認可:
    - itemDraft.seller_id === userId

- 失敗時:
    - itemDraftは保持

### convertItemEditingVideo（itemEditingのvideoをhls変換）

- フロント: /upload/[id]
- route: PATCH /item-editing/:id/convert
- usecase: item_editingに一時保管のvideoをhls変換

- 認可:
    - itemEditing.seller_id === userId

- 成功後:
    - item_editing.converted_urlに変換済み動画のurlを保管
    - item_editing.original_urlは編集しない

- 失敗時:
    - item_editing.converted_url = null
    - item_editing.original_urlは編集しない

### convertItemDraftVideo（itemDraftのvideoをhls変換）

- フロント: /upload/[id]
- route: PATCH /item-draft/:id/convert
- usecase: item_draftに一時保管のvideoをhls変換

- 認可:
    - item_draft.seller_id === userId

- 成功後:
    - item_draft.converted_urlに変換済み動画のurlを保管
    - item_draft.original_urlは編集しない

- 失敗時:
    - item_draft.converted_url = null
    - item_draft.original_urlは編集しない

### updateItem（itemEditingからitemへコピーして更新）

- フロント: /item/confirm/edit/[id]
- route: PUT /items
- usecase: item_editingの内容をitemにコピーして上書き

- 認可:
    - itemEditing.seller_id === userId

- transaction:
    - item
    - video
    - sale
    - itemShippingProfile
    - その他関連レコード
      → 全て同一Transaction

- 成功後:
    - itemEditing削除

- 失敗時:
    - DB変更をrollback
    - itemEditingは保持
    - itemsは変更しない

### getItemDraftPage（下書き商品ページ表示データ取得）

- フロント: /item/draft/[id]
- route: GET /item-draft/:id/item-page

- 認可:
    - itemDraft.seller_id === userId

### getItemConfirmPage（編集中セッションアップロード確認ページ表示データ取得）

- フロント: /item/confirm/[id]
- route: GET /item-editing/:id/confirm

- 認可:
    - itemDraft.seller_id === userId

### getItemEditingForm（商品アップロード入力フォーム初期値取得）

- フロント: /upload/[id]・/upload/edit/[id]
- route: GET /item-editing/:id/form

- 認可:
    - itemEditing.seller_id === userId

---

## cron

### cronDeleteItemEditing

- 実行間隔: 毎日　昼12時
- usecase: 作成から3日経過したitem_editing削除

- 失敗時:
    - item_editing復元
