# convertedItemEditingVideo 詳細設計

基本設計: ../../itemUpload.md

## 1. 概要

商品編集セッション（item_editing）に一時保管している動画をHLS変換する。

HLS変換したファイルをS3にアップロードし、item_editingに変換済みの動画ファイルを格納する。

item_editing.video_statusを"original"から"converted"に書き換える。

HLS変換に失敗した場合は、変換前のファイルをそのまま使用し、特にDBを編集しない。

## 2. API仕様

- Method: PATCH
- Endpoint: /item-editing/:id/convert
- 認証: 必須
- 認可: item_editing.seller_idが認証済みuserIdと一致すること
- Content-Type: application/json
- レート制限: 10分間に5回

- 大分類: itemEditing、小分類: convertedItemEditingVideo

### ファイル・関数名

/server/src

- route: /routes/itemEditing.ts
    - PATCH /item-editing/:id/convert（新規）
- rateLimit: /middleware/rateLimit/itemEditingRateLimit
    - convertedItemEditingVideoRateLimit（新規）
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- paramバリデーション: /validators/params/id.ts
    - idParamSchema（既存）
    - wrapper: /middleware/validate/validateParams.ts
        - validateParams（既存）
- controller: /controllers/itemEditing/itemEditing.ts
    - convertedItemEditingVideoController（新規）
- usecase: /usecases/itemEditing/convertedItemEditingVideo.ts
    - convertedItemEditingVideoUseCase（新規）
- service:
    - itemEditing取得: /services/itemEditing/query.ts
        - getMyItemEditing（既存）
    - 変換前status変更: /services/itemEditing/command.ts
        - editVideoStatus（新規）
            - item_editing.video_statusの値を"processing"にする
    - 変換後item_editing更新: /services/itemEditing/command.ts
        - updateConverted（新規）
            - item_editingのstatusを"done"、converted_urlに変換済みurl、durationに秒数
    - 変換失敗status更新: /services/itemEditing/command.ts
        - editVideoStatus（新規）
            - item_editing.video_statusの値を"failed"にする

※ 使用utils関数は下記参考APIを参照

### 参考API

- route: PATCH /video/:id/convert
- controller: videoPatchByIdConvertController
- usecase: convertVideoUseCase

※ このAPIは何も編集しない。
※ convertVideoUseCaseはvideoテーブルを対象としているが、convertedItemEditingVideoUseCaseはitem_editingテーブルを対象とする

### バリデーション

- itemId: 1〜2147483647の整数、必須（DBのINTEGER範囲）
- 不正なリクエストは400を返す

### レスポンス

```ts
res.status(202).json({ message: "変換処理を受け付けました" });
```

### 三行コメント

```ts
// PATCH /item-editing/:id/convert
// summary: 編集セッション動画HLS変換
// page: /upload/[id]
```

## 3. 認証・認可

所有者確認の対象はitem_editing。

1. 認証ミドルウェア（authenticateToken）からuserIdを取得する
2. itemEditingIdをもとにitem_editingを取得する
3. item_editing.seller_idとuserIdを比較する
4. 一致しない場合は404を返す

存在しないitem_editingに対しては404を返す。

### getMyItemEditing 認可

```ts
where: {
    id: itemEditingId,
    seller_id: userId,
}
```

## 4. 処理フロー

前提：上記参考APIの処理フローをもとに設計する

### 処理フロー図

## 5. DB操作仕様

### 参照テーブル

- item_editing

### 書き込みテーブル

- item_editing

## 6. トランザクション設計

### 成功時・失敗時

### 排他制御

## 7. エラー設計

## 8. テスト設計

### 正常系

### 異常系

### 並行処理

### 境界値

### 条件分岐

### 状態遷移

## 9. 未決定事項
