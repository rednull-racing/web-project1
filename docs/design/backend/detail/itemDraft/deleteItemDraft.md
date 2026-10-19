# deleteItemDraft

基本設計: ../../itemUpload.md

## 1. 概要

ItemDraftを削除する。

処理途中で失敗した場合はItemDraftを復元する。

## 2. API仕様

- Method: DELETE
- Endpoint: /item-draft/:id
- 認証: 必須
- 認可: ItemDraft所有者のみ（item_draft.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json
- レート制限: 5分間に20回

### 分類名称

- 大分類：itemDraft
- 小分類：deleteItemDraft

### ファイル・関数名

/server/src

- route: /routes/itemDraft.ts
- rateLimit: /middleware/rateLimit/itemDraftRateLimit
    - deleteItemDraftRateLimit
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- paramバリデーション: /validators/params/id.ts
    - idParamSchema（既存）
- controller: /controllers/itemDraft/itemDraft.ts
    - deleteItemDraftController
- usecase: /usecases/itemDraft/deleteItemDraft.ts
    - deleteItemDraftUseCase
- service:
    - itemDraft取得: /services/itemDraft/query.ts
        - getMyItemDraft（既存）
    - item_draft削除: /services/itemDraft/command.ts
        - deleteItemDraft（既存）

### バリデーション

- itemDraftId: 1〜2147483647の整数、必須（DBのINTEGER範囲）、パラメータから取得
- 不正なリクエストは400を返す

### レスポンス

### 三行コメント

```ts
// DELETE /item-draft/:id
// summary: 下書き商品削除
// page: /item/draft/[id]
```

## 3. 認証・認可

### getMyItemDraft 認可

```ts
where: {
    id: itemDraftId,
    seller_id: userId,
}
```

## 4. 処理フロー

### 処理フロー図

## 5. DB操作仕様

### 参照テーブル

- item_draft

### 削除テーブル

- item_draft

## 6. トランザクション設計

## 7. エラー設計

## 8. テスト設計
