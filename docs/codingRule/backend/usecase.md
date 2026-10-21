# UseCase コーディング規約

## 基本方針

- UseCase は、Controller から受け取った値をもとに業務処理を組み立てる。
- UseCase は、業務ルールの判定、処理順序、データ変換、計算、所有権・権限・状態の確認を担当する。
- UseCase は DB アクセスを Service 経由で行う。
- UseCase は Express の Request、Response、NextFunction を扱わない。
- UseCase は HTTP ステータスやレスポンス送信を扱わない。
- Controller と直接接続する処理は、機能単位の UseCase として定義する。

---

# ファイル構成

以下の順番で記述する。

```ts
import

入力型・戻り値型

ファイル内だけで使用する関数

3 行コメント

export const useCase = async (): Promise<戻り値型> => {}
```

- 1ファイルに複数の公開UseCaseを定義する場合は、各UseCaseの直前に対応する3行コメントを記載する。
- 同一ファイル内だけで使用する補助関数はexportしない。
- 複数機能から使用する処理は、責務に応じて共通UseCase、Service、またはUtilityへ分離する。

---

# import

- ESM形式で記述し、相対importには `.js` 拡張子を付ける。
- 型だけを使用するimportには `import type` を使用する。
- DB操作を行う関数はServiceからimportする。
- Sequelize Modelは、型として使用する場合を除いてimportしない。
- トランザクションを開始するUseCaseだけがsequelizeインスタンスをimportする。
- 循環参照を発生させない。

例

```ts
import sequelize from "../../../db.js";
import { AppError } from "../../../errors.js";
import { getMyItem, updateItem } from "../../../services/items/index.js";
import type { ItemUploadBody } from "../../../validators/body/items.js";
```

---

# 命名とexport

- Controllerから呼び出すUseCaseは名前付きexportにする。
- Controllerから呼び出す関数名には、処理内容を表す動詞と `UseCase` 接尾辞を使用する。
- 関数名は、取得・作成・更新・削除などの処理内容と対象が判別できる名前にする。
- ファイル名とディレクトリは、既存の機能別構成に合わせる。
- デフォルトexportは使用しない。

例

```ts
export const getItemPageUseCase = async (...): Promise<Result> => {};
export const updateShopSignupUseCase = async (...): Promise<void> => {};
```

---

# 引数

- 引数があるUseCaseは、オブジェクト形式で受け取る。
- 入力型は `Params` などの具体的な型として定義する。
- Controllerからは業務処理に必要な値だけを受け取る。
- `Request`、`Response`、`NextFunction`、未検証の `req.body`、`req.query`、`req.params` を受け取らない。
- 認証ユーザーIDと操作対象IDは、意味が区別できる名前で定義する。
- 更新データは許可されたDTO型を使用し、識別子、所有者、状態などの保護対象属性を混入させない。
- 引数がないUseCaseには、空オブジェクト型や不要な引数を追加しない。

例

```ts
type Params = {
    itemId: number;
    userId: number;
    body: ItemUploadBody;
};

export const updateItemUseCase = async ({ itemId, userId, body }: Params): Promise<void> => {};
```

---

# 戻り値

- 非同期UseCaseは `Promise` の具体的な戻り値型を明示する。
- 戻り値がない処理は `Promise<void>` とする。
- Controllerがレスポンスへ変換できる業務結果を返す。
- HTTPステータス、ExpressのResponse、レスポンス送信処理は返さない。
- 複数の値を返す場合は、意味の分かるプロパティ名を持つオブジェクトにする。
- `Promise<any>`、広すぎる `Record<string, unknown>`、型を隠すための型アサーションを使用しない。

例

```ts
type Result = {
    items: Item[];
    totalPages: number;
};

export const getItemsUseCase = async ({ userId }: Params): Promise<Result> => {
    // ...
};
```

---

# 3行コメント

Controllerと接続する各UseCaseの直上に、対応するRouteと同じ3行コメントを記載する。

```ts
// GET /items/:id
// summary: 商品詳細取得
// page: /item
```

- 1行目にはHTTPメソッドと `/api` より後のパスを記載する。
- 2行目には `summary:` と処理概要を記載する。
- 3行目には `page:` と対応画面を記載する。
- Route、Controller、UseCaseで内容が異なる場合はRouteの記載に統一する。
- Controllerから直接呼ばれないファイル内補助関数と共通処理には、APIの3行コメントを付けない。

---

# Serviceとの境界

- Sequelizeの検索、作成、更新、削除はServiceへ実装する。
- UseCaseから `findByPk`、`findOne`、`findAll`、`count`、`create`、`update`、`destroy` を直接呼び出さない。
- 外部サービスとの通信は、既存のService、Infra、または専用Utilityを経由する。
- UseCaseはServiceから受け取った結果を使って、業務上の存在確認、判定、計算、処理順序を制御する。
- Serviceへ渡す検索条件や更新データには具体的な型を使用する。
- Sequelizeのwhere条件には `WhereOptions` などの適切な型を使用し、`any` を使用しない。

禁止例

```ts
const item = await Item.findByPk(itemId);
```

正しい例

```ts
const item = await getItem({ itemId });
```

---

# 業務条件と入力検証

- schemaで検証できる形式・型・文字数などの入力検証はValidatorへ実装する。
- データの存在、所有権、権限、状態、組み合わせ、他データとの整合性はUseCaseで確認する。
- 所有権が必要な取得では、Serviceの検索条件に対象IDとユーザーIDを含める。
- URLパラメータのIDだけで所有権を判断しない。
- 公開状態、削除状態、取引状態などが操作可否へ影響する場合は、処理前に対象状態を確認する。
- クライアントから受け取った所有者ID、金額、割引額、状態値をそのまま信用しない。

例

```ts
const item = await getMyItem({ itemId, userId });

if (!item) {
    throw new AppError("ITEM_NOT_FOUND", 404);
}
```

---

# データ変換

- APIの入力名からDBカラム名への変換は、UseCaseまたはUseCaseから呼ぶ専用mapperで明示的に行う。
- 更新用オブジェクトは許可するプロパティを列挙して構築する。
- リクエストオブジェクトをスプレッドしてServiceへ渡さない。
- 金額、ポイント、在庫、状態などの業務計算はUseCaseで行う。
- Controllerへ返す複雑なデータ加工はUseCaseまたは専用mapperで行う。

---

# トランザクション

- 複数のDB更新を一体として成功または失敗させる処理は、UseCaseでトランザクションを開始する。
- 同一処理内のすべてのServiceへ、同じtransactionを渡す。
- transaction内のService呼び出しは必ず `await` する。
- transactionのcommitとrollbackをServiceやControllerで管理しない。
- トランザクション外で取得したデータを更新する場合も、更新Serviceへtransactionを渡す。

例

```ts
await sequelize.transaction(async (transaction) => {
    await updateItem({ item, data, transaction });
    await createNotification({ notificationData, transaction });
});
```

---

# 非同期処理

- UseCaseから呼び出すUseCase、Service、Infra、UtilityのPromiseは必ず `await` する。
- `.catch(console.error)` や、`.catch()`でログだけを残して処理を継続する実装は禁止する。
- UseCase内部でPromiseを切り離して実行しない。
- HTTPレスポンス後も継続する処理は、Controller側の共通実行境界からUseCase全体を起動する。
- 共通実行境界より内側では失敗を上位へ伝播させる。
- 独立して並行実行できる処理だけを `Promise.all` で実行する。
- 順序依存または途中失敗時の整合性が必要な処理は、実行順を明示して `await` する。

---

# エラー処理

- 業務上想定される失敗には既存の `AppError` を使用する。
- エラーコードとステータスは既存APIの契約に合わせる。
- DB、外部サービス、下位UseCaseのエラーを理由なく握りつぶさない。
- 同じエラーを投げ直すだけの `try/catch` は追加しない。
- エラーを別の業務エラーへ変換する場合は、元の失敗を隠してよい仕様であることを確認する。
- パスワード、トークン、Cookie、個人情報、シークレットをエラーログへ出力しない。

例

```ts
if (!user) {
    throw new AppError("USER_NOT_FOUND", 404);
}
```

---

# 型

- `any` を使用しない。
- 不明なエラー値などは `unknown` とし、型を絞り込んでから使用する。
- 型エラーを回避するためだけの `as`、非nullアサーション、広いindex signatureを使用しない。
- Validatorから受け取る値には、schemaから推論された型または既存のValidator型を使用する。
- Serviceの引数と戻り値には、既存のService型または具体的な型を使用する。
- Sequelize Modelを型として参照する場合は `import type` を使用する。
- 複数ファイルで共有する型は責務に合うtypesディレクトリへ配置する。
- 1ファイル内だけで使用する型は、そのUseCaseファイル内に定義する。

---

# UseCase間の呼び出し

- 上位UseCaseは、1つの業務フローを構成する下位UseCaseを呼び出してよい。
- UseCase間の呼び出しは必ず `await` し、失敗を呼び出し元へ伝播させる。
- DBアクセスだけを再利用する目的でUseCaseを呼ばず、Serviceを使用する。
- 相互参照や循環importを発生させない。

---

# 禁止事項

- Expressオブジェクトの受け取りと操作
- HTTPレスポンス形式やHTTPステータスの決定
- Sequelize Modelを使った直接DB操作
- 未検証のrequest値の受け取り
- `any` と型回避目的の型アサーション
- 必要な所有権・権限・状態確認の省略
- Promiseの未await実行
- エラーをログだけに残して処理を成功扱いにする実装
- ControllerやServiceへ業務ロジックを移す実装
- 新しいライブラリや基盤の独断での追加
