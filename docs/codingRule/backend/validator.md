# Validator コーディング規約

## 基本方針

- Validator は、Route が受け取る body、params、query を Zod で検証する。
- Validator は入力値の型、形式、必須・任意、文字数、数値範囲、有限な選択肢を定義する。
- Validator は、検証後に Controller と UseCase が使用する値の型を確定する。
- Validator に HTTP レスポンス処理、DB アクセス、所有権確認、権限確認、状態判定を書かない。
- Validator の schema は Route から validate middleware へ渡して使用する。
- Route は、Controller が request 値を使用する前に対応する validate middleware を実行する。

---

# ディレクトリ構成

入力元ごとにディレクトリを分ける。

```text
validators/
├── body/
├── params/
└── query/
```

- `body` には `req.body` の schema を配置する。
- `params` には `req.params` の schema を配置する。
- `query` には `req.query` の schema を配置する。
- admin、maintenance など機能単位の下位ディレクトリがある場合は、対応する Route の構成に合わせる。
- body、params、query を同じ schema で兼用しない。
- 依頼に含まれない既存 Validator の移動、統合、分割は行わない。

---

# ファイル構成

以下の順番で記述する。

```ts
import

ファイル内だけで使用する定数

ファイル内だけで使用する補助 schema・検証関数

export const schema

export type
```

- 同一ファイルに複数の schema がある場合も、補助定義、公開 schema、推論型の順にまとめる。
- ファイル内だけで使用する定数、補助 schema、検証関数は export しない。
- 複数の Validator から使用する schema 断片だけを名前付き export する。
- デフォルト export は使用しない。
- Route、Controller、UseCase の 3 行コメントを記載しない。

---

# ファイル名

- ファイル名は検証対象の機能を表す camelCase にする。
- body、params、query の区別はディレクトリで表し、ファイル名へ重複して追加しない。
- 同じ入力契約を複数 Route で使う場合は、対象を表す共通ファイルへ配置する。
- `common.ts`、`schema.ts`、`validator.ts` のように対象を判別できない名前を使用しない。

例

```text
validators/body/bankAccount.ts
validators/params/id.ts
validators/query/items.ts
```

---

# import

- Zod は `import z from "zod";` で import する。
- 相対 import には `.js` 拡張子を付ける。
- 型だけを使用する import には `import type` を使用する。
- schema が使用する runtime 定数は通常の import で読み込む。
- 他の Validator の schema 断片を共有する場合は、入力の意味と制約が同じものだけを import する。
- Controller、UseCase、Service、Sequelize Model を import しない。
- 循環 import を発生させない。

例

```ts
import z from "zod";

import { ACCOUNT_TYPES } from "../../types/bankSnapshot.js";
```

---

# schema の命名と export

- schema は名前付き export にする。
- body の schema 名は `...BodySchema` で終える。
- query の schema 名は `...QuerySchema` で終える。
- params の schema 名は `...ParamSchema` で終える。
- 名前には処理または入力の対象を含め、Route から用途を判別できるようにする。
- ファイル内だけで使用する schema にも `Schema` 接尾辞を付ける。
- 同じ schema を別名で重複定義しない。

例

```ts
export const createCommentBodySchema = z.object({
    inputComment: z.string().min(1),
});

export const itemListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
});

export const idParamSchema = z.object({
    id: z.coerce.number().int().positive(),
});
```

---

# 推論型

- Controller または他の層が検証済みデータを使用する場合は、schema から `z.infer` で型を生成する。
- 推論型は対応する schema と同じファイルで名前付き export する。
- body の推論型は `...Body`、query の推論型は `...Query`、params の推論型は `...Params` とする。
- schema と同じ構造を手書きの type または interface で複製しない。
- schema を変更した場合は、`z.infer` の結果が利用側の契約と一致することを確認する。
- 推論型を値として import しない。利用側では `import type` を使用する。

例

```ts
export const zipcodeQuerySchema = z.object({
    zipcode: z.string().length(7),
});

export type ZipcodeQuery = z.infer<typeof zipcodeQuerySchema>;
```

---

# オブジェクト schema

- 受け付けるキーの組み合わせが 1 種類の場合は、トップレベルを `z.object({...})` で定義する。
- 排他的な複数の入力構造を受け付ける場合は、トップレベルを `z.union(...)` または `z.discriminatedUnion(...)` で定義する。
- リクエストで受け付けるキーだけを schema に列挙する。
- キー名は実際の API 契約と一致させる。
- ネストしたオブジェクトと配列も、要素の構造まで Zod schema で定義する。
- 構造が不明な `z.any()`、`z.unknown()`、`z.record(z.string(), z.unknown())` を既知の入力へ使用しない。
- 不要なリクエストキーを UseCase や Service へ渡さず、Zod の parse 結果だけを使用する。
- 1 つの更新フィールドだけを受け付ける API は、1 キーの strict object を並べた `z.union` で表す。

更新フィールドを限定する例

```ts
export const updateBodySchema = z.union([
    z.object({ email: z.string() }).strict(),
    z.object({ phone_number: z.string() }).strict(),
]);
```

---

# 文字列

- 前後の空白を値として扱わない文字列には `.trim()` を指定する。
- 空文字を許可しない場合は `.min(1)` を指定する。
- 固定長の値には `.length()` を使用する。
- 最小長と最大長が決まっている値には `.min()` と `.max()` を指定する。
- メールアドレス、電話番号、郵便番号など形式が決まっている値は、Zod の専用 schema または regex で検証する。
- 大文字と小文字を区別しない検索語は `.toLowerCase()` で正規化する。
- 任意の文字列を許可する仕様でない限り、制約のない `z.string()` を使用しない。

---

# 数値

- JSON body で数値を受け取る場合は `z.number()` を使用する。
- 文字列として届く params と query を数値として扱う場合は `z.coerce.number()` を使用する。
- 整数だけを許可する場合は `.int()` を指定する。
- 正数だけを許可する場合は `.positive()` を指定する。
- 0 を許可する場合は `.min(0)` を使用し、`.positive()` を使用しない。
- 上限と下限が仕様で決まっている場合は `.min()` と `.max()` を指定する。
- ページ番号、limit、cursor、ID は、負数、小数、0 を許可するかを API ごとに明示する。
- 数値へ変換できない値を独自の `Number()` や `parseInt()` で変換せず、Zod の coercion を使用する。

---

# boolean

- JSON body の boolean には `z.boolean()` を使用する。
- query の `"true"` と `"false"` を boolean として使う場合は、`z.enum(["true", "false"])` で限定してから `.transform()` する。
- 任意の文字列を truthy / falsy として変換しない。
- 省略時の値が API 契約で決まっている場合は `.default()` を指定する。

例

```ts
const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");
```

---

# 日付

- parse 前に `Date` オブジェクトであることが保証される入力には `z.date()` を使用する。
- HTTP で文字列として届く日時には、API が受け付ける形式に対応する Zod の日時 schema を使用する。
- 日時文字列を Validator で `Date` に変換する場合は、変換後の値が有効な日時であることまで検証する。
- 過去日・未来日の制限が入力仕様に含まれる場合は、schema または同期的な `refine` で検証する。
- タイムゾーンと offset の許可条件を API 契約に合わせる。

---

# enum と有限値

- 取り得る値が有限の場合は `z.string()` ではなく `z.enum()` を使用する。
- enum の値は `as const` の配列に定義する。
- 同じ値を実行時処理でも使用する場合は、責務に合う共通定数を import する。
- enum に対応する TypeScript 型を他の層で使用する場合は、定数から型を生成するか schema から `z.infer` する。
- enum の配列、生成した型、Zod schema に同じ値を重複して手書きしない。

例

```ts
const followTypes = ["follow", "follower"] as const;

export const followUserListQuerySchema = z.object({
    type: z.enum(followTypes),
});

export type FollowType = (typeof followTypes)[number];
```

---

# optional、nullable、default

- キー自体を省略できる場合だけ `.optional()` を使用する。
- キーは存在し、値として null を受け付ける場合だけ `.nullable()` を使用する。
- 省略と null の両方を受け付ける場合は `.optional().nullable()` または `.nullish()` を使用する。
- 省略時の値が API 契約で決まっている場合だけ `.default()` を使用する。
- 必須入力を Controller や UseCase の都合で optional にしない。
- default 適用後の推論型と、Controller が期待する型を一致させる。

---

# transform、pipe、refine

- `.transform()` は、空白除去、大小文字統一、記号除去、文字列から boolean への変換など、入力の正規化に使用する。
- transform 後の値に形式制約がある場合は `.pipe()` で検証する。
- `.refine()` は、単一入力から同期的に判定できる形式検証に使用する。
- 複数フィールドの形式上の組み合わせを検証する場合は、object schema に `.refine()` または `.superRefine()` を指定する。
- DB 取得、外部通信、所有権確認、権限確認を transform、refine、superRefine から実行しない。
- transform で API の入力名を DB カラム名へ変更しない。その変換は UseCase または専用 mapper で行う。
- 入力値を破壊的に変更する正規化は行わず、Zod の parse 結果として新しい値を返す。

例

```ts
const phoneNumberSchema = z
    .string()
    .transform((value) => value.replace(/[^0-9]/g, ""))
    .pipe(z.string().regex(/^0[0-9]{9,10}$/));
```

---

# schema の共有

- 同じ入力項目が同じ意味と制約を持つ場合は、共通の補助 schema または既存の公開 schema 断片を使用する。
- 1 ファイル内だけで使用する補助 schema は、そのファイル内で `const` として定義する。
- 複数の Validator から使用する schema 断片は、対象を表す Validator ファイルから名前付き export する。
- 名前が同じでも API ごとに制約が異なる入力は共通化しない。
- 共通化のために制約を弱めない。
- schema 全体を再利用した結果、不要なキーまで受け付ける構成にしない。

---

# Route と validate middleware

- body schema は `validateBody(...)`、params schema は `validateParams(...)`、query schema は `validateQuery(...)` へ渡す。
- schema は対応する Controller より前の middleware として Route に指定する。
- Route が body、params、query の複数を使用する場合は、それぞれに対応する Validator を指定する。
- `validateBody` の結果は `req.validatedBody`、`validateParams` の結果は `req.validatedParams`、`validateQuery` の結果は `req.validatedQuery` に保存される。
- body と query の検証結果を使う Controller は、対応する `z.infer` の型を type import し、`req.validatedBody` または `req.validatedQuery` へ適用する。
- params は Route で `validateParams` を実行してから Controller で使用する。coerce や transform 後の値が必要な場合は、対応する推論型を `req.validatedParams` へ適用する。
- Route または Controller で `schema.parse()`、`safeParse()` を重複して呼び出さない。
- Validator で検証していない request 値を、型アサーションだけで検証済みとして扱わない。

---

# エラー処理

- Validator ファイルから `AppError` を throw しない。
- schema の失敗は validate middleware に処理させる。
- body、params、query のエラーコードは validate middleware の既存契約に従う。
- Validator 内で ZodError を catch して別のエラーへ変換しない。
- エラーの HTTP レスポンスを Validator に記述しない。
- パスワード、token、本人確認情報などの入力値をログへ出力しない。

---

# レイヤー境界

- Validator は外部入力の構造と形式を検証する。
- データの存在、所有権、権限、status、他データとの整合性は UseCase で確認する。
- DB カラムへの変換、業務計算、複数 Service の処理順序は UseCase が担当する。
- Sequelize Model、transaction、Service 関数を Validator へ持ち込まない。
- Validator の型だけを理由に外部入力を信用せず、必ず validate middleware を通す。

---

# 型安全性

- `any` を使用しない。
- `z.any()` を使用しない。
- 構造が不明な入力を受け付ける契約では `z.unknown()` を使用し、利用前に別の schema で絞り込む。
- 型アサーションで schema と推論型の不一致を隠さない。
- 有限値を広い `string` や `number` として定義しない。
- schema の入力型と transform 後の出力型を区別し、Controller には出力型を渡す。

---

# コメント

- schema 名とフィールド名だけで分かる制約にはコメントを付けない。
- regex、チェックデジット、互換性要件など、コードだけでは意図が分からない制約には短いコメントを付ける。
- コメントには処理の説明ではなく、制約の理由を記載する。
- 一時的な調査メモや未確定の仕様を記載しない。

---

# 禁止事項

- Validator への HTTP レスポンス処理、DB アクセス、業務ロジックの追加
- Controller、UseCase、Service、Sequelize Model の import
- `any`、`z.any()`、型回避目的の型アサーション
- schema と同じ構造を持つ手書き型の重複定義
- body、params、query の schema の兼用
- 有限値に対する制約のない `z.string()`
- params と query の数値を未検証の文字列のまま通す実装
- ユーザー入力を使った非同期 DB 検証や外部通信
- Validator からの `AppError` と HTTP エラーの生成
- validate middleware を通さない検証済み型の適用
- 依頼範囲外の Validator の移動、改名、統合、分割
