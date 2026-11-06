# getItemTrashList 詳細設計

基本設計: [商品削除API設計](../../itemDelete.md)

## 1. 概要

`client/src/app/item-list/trash`ページで表示する `item_trash` の一覧を取得し、フロントエンドにJSONで返す。

取得条件はapiUrlのクエリに記載し、クエリの条件通りに取得し、フロントエンドに返却する。

## 2. API仕様

- Method: GET
- Endpoint: /api/item-trash/list
- Router内の相対パス: /list（`routes/index.ts` の既存 `/api/item-trash` 登録を利用）
- 認証: 必須
- 認可: 論理削除商品（ItemTrash）所有者のみ（item_trash.seller_idが認証済みuserIdと一致すること）
- Content-Type: application/json（レスポンス。リクエストbodyは不要）
- レート制限: 認証ユーザー単位で1分間に50回。超過時は429。
- 制限設定: `windowMs: 60000`、`limit: 50`、`standardHeaders: true`、`legacyHeaders: false`。既存形式の `admin:${認証済みuserId}` をキーとするAPI専用インスタンスを追加する。
- 制限計上: 認証後の400・404・500も含む。未認証は計上しない。51回目以降は429と既存ライブラリの既定本文・RateLimit/Retry-Afterヘッダーを返し、窓終了後に再受付する。GETでも不正JSONを送った場合はアプリ共通parserが先に400とし、認証・制限へ到達しない。
- 順序: authenticateToken → getItemTrashListRateLimit → validateParams(idParamSchema) → getItemTrashListController

### ファイル・関数名

以下のパスは `server/src` 基準。上書き・新規・拡張の記載は初回設計時の区分である。

- route: /routes/itemTrash.ts
- rateLimit: /middleware/rateLimit/itemTrashRateLimit.ts
    - getItemTrashListRateLimit（新規）
- 認証: /middleware/authMiddleware.ts
    - authenticateToken（既存）
- queryバリデーション: /validators/params/itemTrash.ts
    - getItemTrashListQuerySchema（新規）
    - type: GetItemTrashListQuery（新規）
    - wrapper: /middleware/validate/validateQuery.ts
        - validateQuery（既存）
- controller: /controllers/itemTrash/itemTrash.ts
    - getItemTrashListController（新規）
- usecase: /usecases/itemTrash/getItemTrashList.ts
    - getItemTrashListUseCase（新規）
- service:
    - itemTrashList取得: /service/itemTrash/query.ts
        - getMyItemTrashList（新規）
        - 引数型: `Pick<GetItemTrashListParams, "itemTrashId" | "userId" | "where" | "limit" | "offset">` /types/serviceType/itemTrash.tsで定義する
    - itemTrashListカウント取得: /service/itemTrash/query.ts
        - countMyItemTrashList（新規）
        - 引数型: `Pick<CountItemTrashListParams, "where">` /types/serviceType/itemTrash.tsで定義する

### リクエスト

`GET /item-trash/list?page=7&keyword=""`（bodyなし）

### queryバリデーション

- page: number・default=1, 下限1・上限10000
- keyword: string | null

### レスポンス

成功時: 200 OK

```json
{
    "itemTrashList": [
        {
            "itemTrash": {
                "id": 123,
                "name": "",
                "price": 1000,
                "first_image_url": "",
                "title": "",
                "createdAt": "2026-11-06T00:00:00.000Z"
            },
        },
    ],
    "totalPages": 7
}
```

- `totalPages` は、`countMyItemTrashList` で取得したitem_trashの総カウントを `20` で割り、小数点以下を切り上げた値。

### 三行コメント

```ts
// GET /item-trash/list?page=number&keyword=""
// summary: 削除した商品リスト取得
// page: /item-list/trash
```

## 3. 認証・認可

`authenticateToken` の認証済みuserIdと、URLのitemDraftIdで所有者の下書きを検索する。未認証は401、存在しない場合・他人の下書きの場合はともに404を返す。

### getMyItemTrashList 認可

```ts
where: {
    seller_id: userId,
    ...where,
}
```

## 4. 処理フロー

1. 認証を確認する（未認証は401）。
2. レート制限を確認する（超過は429。不正なパラメータも回数に含む）。
3. クエリを検証し、page, keywordをusecaseに渡す（不正は400）。
4. usecaseでlimit, offset, whereを定義する。
5. serviceでitem_trashをfindAll()で取得する（getMyItemTrashList）。
6. serviceでitem_trashのカウントを取得する（countMyItemTrashList）。
7. totalCountとlimitからtotalPagesを計算し、usecaseからcontrollerへitemTrashListとtotalPagesを返却する。
8. controllerは例外を `next(err)` へ渡し、共通errorHandlerが公開応答を生成する。

### 処理フロー図

```mermaid
flowchart TD

```

## 5. DB操作仕様

### 参照テーブル

- item_trash

## 6. トランザクション設計

## 7. エラー設計

## 8. テスト設計

- 正常:
- 認証・認可:
- 入力境界:
- 制限・優先順位:
- 失敗・待機:
- 再送・並行:
