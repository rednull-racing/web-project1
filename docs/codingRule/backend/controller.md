# Controller コーディング規約

## 基本方針

- Controller は `req.params`、`req.query`、`req.body`、`req.user` から値を取得する。
- Controller は UseCase を呼び出す。
- Controller は HTTP レスポンスを返す。
- エラーは `next` へ渡す。
- route の 3 行コメントを、対応する処理の上にそのまま記載する。

---

# ファイル構成

以下の順番で記述する。

```ts
import

3 行コメント

export const Controller = async (): Promise<void> => {}
```

複数の Controller がある場合も、この並びを繰り返す。

---

# import

- Express の `Request`、`Response`、`NextFunction` は type import で記述する。
- UseCase を import する。
- validator の型を使用する場合は type import する。
- `AppError` を使用する場合は import する。

例

```ts
import type { NextFunction, Request, Response } from "express-serve-static-core";
import { AppError } from "../errors.js";
import { createItemsUseCase } from "../usecases/items/upload/createItem.js";
import type { ItemUploadBody } from "../validators/body/items.js";
```

---

# 3 行コメント

各 Controller の上に route と同じ 3 行コメントを記載する。

```ts
// POST /items
// summary: 商品データ作成
// page: /upload/before
```

---

# Controller 定義

- Controller は名前付き export にする。
- `async` 関数で定義する。
- 戻り値は `Promise<void>` とする。
- 引数は `req`、`res`、`next` の順に記述する。

例

```ts
export const createItemController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
```

---

# 値の取得

- `req.params.id` は `Number()` または `parseInt()` で数値化している。
- 認証必須の処理では `req.user!.id` を使用している。
- 任意認証の処理では `req.user?.id ?? null` または `req.user?.id ?? undefined` を使用している。
- query は `req.validatedQuery as 型名` で取得している。
- body は `req.validatedBody as 型名` で取得している。

例

```ts
const itemId = Number(req.params.id);
const userId = req.user!.id;
const query = req.validatedQuery as ItemListQuery;
const body = req.validatedBody as ItemUploadBody;
```

---

# UseCase 呼び出し

- Controller から直接 UseCase を呼び出す。
- UseCase には、Controller 内で取り出した値をオブジェクトで渡す。
- query の値によって呼び出す UseCase を切り替える実装は、Controller 内で行っている。

例

```ts
const usecase = query.mode === "main" ? uploadMainUseCase : uploadDraftUseCase;

const result = await usecase({
    itemId,
    userId,
    body,
});
```

---

# エラーハンドリング

- 通常の非同期処理は `try/catch` で囲む。
- `catch` では `next(err)` を呼ぶ。
- バリデーション後でも条件不足がある場合は `AppError` を throw している。

例

```ts
try {
    const itemId = Number(req.params.id);

    res.status(200).json({ itemId });
} catch (err) {
    next(err);
}
```

---

# レスポンス

- 正常終了時は `res.status(...).json(...)` を返す。
- ステータスコードは処理内容に応じて `200` または `202` を使用している。
- レスポンスのキー名は UseCase の戻り値や処理内容に合わせて個別に定義する。

例

```ts
res.status(200).json({ itemId });
```

```ts
res.status(202).json({ message: "sort_numberの更新を受け付けました" });
```

---

# 非同期受付のみ行う処理

一部の処理は UseCase を `await` せずに起動し、Controller は `202` を返している。

その場合は `.catch()` でエラーを受けている。

例

```ts
patchItemLogsAccessUseCase({ itemId, userId }).catch((err) => {
    console.error(err);
});

res.status(202).json({ message: "商品ページアクセス処理を受け付けました" });
```
