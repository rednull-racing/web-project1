# validators/AGENTS.md

## 対象

このディレクトリ内の Validator を作成・修正する場合に適用する。

## このディレクトリの役割

各 Route が受け取る入力値を検証する Zod schema と、その推論型を定義する。

Validator は入力値の構造と形式を扱う。
データの存在、所有権、権限、status などの業務条件は UseCase で確認する。

## ディレクトリ

- `/body`
    - `req.body` の schema を配置する。
- `/params`
    - `req.params` の schema を配置する。
- `/query`
    - `req.query` の schema を配置する。

admin、maintenance などの下位ディレクトリは、対応する Route の機能構成に合わせる。

## Route との関係

- body schema は `validateBody` から使用する。
- params schema は `validateParams` から使用する。
- query schema は `validateQuery` から使用する。
- schema は対応する Controller より前の middleware として Route に指定する。
- Route や Controller に同じ入力検証を重複して実装しない。

## コーディング規約

Validator の実装は、次の規約に必ず従う。

`/docs/codingRule/backend/validator.md`

schema の構成、命名、型推論、値変換、レイヤー境界などの詳細はコーディング規約を参照する。

## スコープ管理

- 現在依頼されている範囲以外は変更しない。
- 依頼に含まれない Validator の移動、統合、分割、命名変更は行わない。
- 対象外の問題は、ルートの `AGENTS.md` と `/docs/todo/AGENTS.md` に従って Todo に記録する。

## 単体テストの共通ルール

本節はこのディレクトリ配下の単体テストに適用する。上位の [src/AGENTS.md](../AGENTS.md) の単体テスト共通ルールと、対象までの AGENTS.md を読む。テストは対象 schema に最も近い `test` に置く。共通 fixture は [fixture 規則](../../test/fixtures/AGENTS.md) に従い、既存の `src/**/test` に近接した単体 fixture の再利用も認める。配置統一だけを目的とした移動は行わない。

### 実 schema と検証範囲

- 対象の実 schema を import し、`safeParse`／`parse` を使う。schema 自体や Zod をモックせず、受理・拒否に加え、変換後の値、未知キーの除去、配列順、元入力の不変性を対象の契約に応じて確認する。
- schema が保証する入力の構造・形式と、usecase が扱う存在・所有権・status 等の業務条件、DB の制約を区別する。schema で受理されたことから保存成功や認可済みを保証しない。
- 実 `validateBody`／`validateParams` を schema とともに直接呼ぶ既存の単体テストもある。ここでは検証済み値の引渡しを確認し、Router の接続・HTTP レスポンス・共通 errorHandler の保証は [結合テスト規則](../../test/integration/usecases/AGENTS.md) に従って分ける。
- ケースは [設計書規則](../../test/docs/architecture/AGENTS.md) に従い、敵対的な入力を含めて考える。所有者や status を装う未知キー、型違い、欠落、特殊表記、重複した入れ子など、通してはいけない値と、制限を追加してはいけない値の両方を検証する。

### 入力条件と境界

- 標準 body は factory でケースごとに新しく作り、原則として一つの項目・条件だけを変える。型不正や欠落用の helper は fixture の操作に限定し、schema の変換や refinement を再実装しない。
- required・optional・nullable を区別し、欠落、`undefined`、`null`、空文字、空配列、必須オブジェクト自体の欠落・型違い、入れ子の各項目を確認する。optional なファイル全体の省略と、ファイルを渡した場合の内部必須項目の省略を混同しない。
- 数値は下限・上限が定義された項目ごとに直前／一致／直後、0、負数、小数、数値文字列を確認する。文字列・配列も定義された長さ・件数制約に合わせる。ID 全体へ同じ上限を課さず、上限未定義の schema が大きな値を受理する観測と、明示された上限制約を区別する。
- `z.number()` と `z.coerce.number()` の契約を分ける。body の正整数 ID の数値文字列拒否と、params の文字列から数値への変換を同じ期待値にしない。params の先頭ゼロ・指数表記等も対象 schema の許容範囲を確認する。
- `NaN`・`Infinity`・`undefined` や、params への boolean・配列等の直接注入は、通常の HTTP JSON／URL パラメータでは到達しない入力として明示する。coerce が値を受理する観測を、HTTP の仕様や「数値以外はすべて拒否」という保証に拡大しない。
- 任意文字列、ENUM、文字数、MIME、配列件数、素材比率合計などは対象 schema ごとに確認する。例えば `genderAge.gender` と `age` は片側を正常にして他側の不正を独立に検証し、別項目の失敗で期待する拒否が隠れないようにする。似た body schema の制約を横展開しない。
- 文字数制約がある場合は日本語・補助平面の文字を使い、対象が数える文字数と UTF-16 の長さを混同しない。上限がない項目への長文受理は、制限済みの項目と分けて扱う。

### 未知キー・refinement・middleware

- `userId`・`seller_id`・別の ID・`status` 等の未知キーを含む入力を作り、トップレベルと入れ子で除去される結果を確認する。除去後の値を完全一致で検証し、元入力を変更しない契約も確認する。
- 独自 refinement は拒否だけでなく issue の `path` と配列位置を検証する。重複 `uiId` は複数の後続重複、空文字、大小文字・空白の違い、画像の有無・状態を対象に応じて組み合わせる。一意な配列は値と順序が保持されることを確認する。
- 複数不備の優先順位を検証する場合はその目的を明示する。単一項目の不正検証とは分け、現行 schema にない優先順位や正規化を期待しない。
- 実 `validateBody`／`validateParams` の成功時は、parse 後の値だけが `validatedBody`／`validatedParams` へ設定され、`next` が引数なしで 1 回呼ばれることを確認する。元の `req.body`／`req.params` と検証済み値を区別する。
- 失敗時は同期的に throw される `AppError` の型・`code`（`INVALID_BODY`／`INVALID_PARAMS`）・`statusCode: 400` と、`next` 未呼出し・新規 Request に検証済み値が設定されないことを確認する。`next(error)` や Promise の reject を期待しない。
- 部分的な Request／Response や意図的な型不正入力への型アサーションは必要最小限にする。失敗時ログを抑える `console.error` の spy は `afterEach` で復元する。

### 参考例と変更後の確認

- [createItem.test.ts](body/test/createItem.test.ts)、[createItemEditingCopy.test.ts](body/test/createItemEditingCopy.test.ts)：上限付きの厳密な数値 ID、未知キー、実 `validateBody`。
- [id.test.ts](params/test/id.test.ts)：params ID の変換・上下限・特殊表記と非 HTTP 型の観測。
- [createItemEditingDraft.test.ts](body/test/createItemEditingDraft.test.ts)：上限未定義の ID、JSON 外の数値、近接 fixture の再利用。
- [createItemDraft.test.ts](body/test/createItemDraft.test.ts)、[updateConfirm.test.ts](body/test/updateConfirm.test.ts)：必須・nullable・optional、入れ子、重複 `uiId` の issue 位置。ENUM・文字数の制約は両 schema で異なるため、それぞれの契約を確認する。

実装変更時は上位の単体テスト共通ルールに従って対象テスト・lint・本番およびテストの型検査を行い、[レポート規則](../../test/docs/report/AGENTS.md) に従って確認範囲と未実行事項を記録する。文書のみの変更では相対リンク・参照例・差分を確認し、テスト・lint・型検査を未実行と明記する。
