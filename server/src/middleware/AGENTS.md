## このディレクトリについて

認証・認可、入力値検証、レート制限など、Route と Controller の間で実行する Express Middleware を配置するディレクトリです。

Middleware はリクエストの前処理と共通の判定を担当し、業務ロジックは持たせません。

```
middleware/
├── authMiddleware.ts     # JWT を必須で検証し、認証ユーザーを req.user に設定
├── authOptional.ts       # JWT がない場合も許可し、取得できたユーザーを req.user に設定
├── isAdmin.ts            # 認証ユーザーの管理者権限を確認
├── session.ts            # セッション ID の発行と req.sessionId への設定
├── index.ts              # 共通 Middleware の re-export
├── rateLimit/            # 各 Route に適用するレート制限
└── validate/             # body・params・query の Zod バリデーション
```

## Route との関係

```
Request
    ↓
Route
    ↓
Middleware（認証・認可・レート制限・入力値検証）
    ↓
Controller
```

- Route で必要な Middleware を選び、Controller より前に指定する。
- Middleware は記述順に実行されるため、前段の処理結果に依存する場合は順序を守る。
- `isAdmin` は `authenticateToken` より後に指定する。
- `req.user` をキーにするレート制限は、ユーザー情報を設定する認証 Middleware より後に指定する。
- 既存 Route を修正する場合は、挙動を変えないよう Middleware の種類と順序を維持する。

## 認証・認可

- 認証必須の Route では `authenticateToken` を使用する。
- 未認証ユーザーも利用でき、認証情報がある場合のみ利用する Route では `authenticateOptional` を使用する。
- 管理者 Route では `authenticateToken` の後に `isAdmin` を使用する。
- 認証結果は `req.user` から利用する。

## rateLimit

機能ごとにレート制限を定義し、対象の Route に個別に適用します。

詳細は `rateLimit/AGENTS.md` に従ってください。

## validate

- Zod スキーマは `validators` 配下に定義し、Route から `validateBody`、`validateParams`、`validateQuery` へ渡す。
- 検証済みの値はそれぞれ `req.validatedBody`、`req.validatedParams`、`req.validatedQuery` に設定する。
- バリデーション Middleware は、検証済みの値を使用する Controller より前に指定する。
- 検証失敗時は既存の `AppError` を使用し、400 エラーとして扱う。

## 基本方針

- 新しい Middleware を作成する前に、既存の共通 Middleware で対応できないか確認する。
- Request の型を拡張する場合は、既存の `express-serve-static-core` の宣言拡張に合わせる。
- エラーは直接握りつぶさず、既存の方法に合わせてレスポンスするかエラーハンドラーへ渡す。
- 新規実装は既存ファイルの命名、ESM の import、構成に合わせる。

## 単体テストの共通ルール

[親ディレクトリの単体テスト共通ルール](../AGENTS.md#単体テストの共通ルール)を前提とする。以下は middleware の直接実行に関する追加ルールであり、validator 単体の schema 検証や、実 Express に接続した HTTP 結合テストと分ける。

### 参考例と検証境界

- [params 検証](validate/test/deleteItemDraft.test.ts)：実 `validateParams` と実 `idParamSchema` を接続し、検証値の格納、raw params の保持、失敗時の停止を確認する。
- [errorHandler](test/ErrorHandler/ErrorHandler/errorHandler.test.ts)：エラーを直接渡し、分類条件と公開レスポンスを確認する。[エラー fixture](../../test/fixtures/ErrorHandler/ErrorHandler/fixtures.ts)は合成した parser 例外・DB 例外と公開期待値を用意する。
- 上記の成功だけで、実 parser が同じ例外を生成すること、Express が例外を捕捉すること、Route の登録・middleware の順序・認証・レート制限まで保証しない。実 parser と errorHandler の接続は [HTTP 結合テスト規則](../../test/integration/usecases/AGENTS.md#http認証共通-middleware)に従う。

### Request・Response・next の直接実行

- 各ケースで対象が読む項目だけを持つ部分的な Request と、`vi.fn` の Response・next を新しく作る。型アサーションはこの Express 境界に限定し、実アプリ全体を初期化しない。
- `res.status(...).json(...)` を使う対象では status が json を持つ値を返すようにし、status・公開 JSON・呼出し回数・next の呼出し有無を検証する。レスポンスを返さない対象では status/json が呼ばれないことも確認する。
- 正常時の `next()`、同期 `throw`、`next(err)`、直接レスポンスを区別し、対象の契約に合わせて検証する。すべての middleware に同じエラー伝播方式を要求しない。非同期の対象は Promise を await する。
- ログ出力を抑える `console.error` 等の spy は各テストで用意し、`afterEach` で復元する。ログを契約として確認するケースでは、抑制するだけでなく呼出し回数・引数も検証する。

### 検証値の格納と失敗時の停止

- 実 schema を渡し、成功時に `validatedBody`・`validatedParams`・`validatedQuery` の対応する格納先へ解析結果が入ることを確認する。型変換・未知キーの除去等を含む検証値と、元の body・params・query を区別し、raw 値が書き換わらないことも確認する。
- `validateParams` の既存例では、数値文字列が数値の id に変換され、余分なキーは検証値へ含まれず、raw params には残る。schema の全入力規則を middleware のテストへ重複展開せず、値の受渡しと停止が主対象になるケースを選ぶ。
- `validateBody`・`validateParams`・`validateQuery` の現行契約は失敗時の同期 `AppError` throw である。対応する code（`INVALID_BODY`・`INVALID_PARAMS`・`INVALID_QUERY`）と 400、next とレスポンスの未実行を確認する。
- 失敗時は未設定の validated 値が作られないことに加え、既存の validated 値を持つ Request を直接渡しても、その参照が上書きされないことを確認する。これは再利用 Request の防御確認であり、実 HTTP の通常経路で同じ Request が再利用される保証とは扱わない。

### エラー分類と公開情報

- JSON parse エラーの現行分類は `SyntaxError`、`type === "entity.parse.failed"`、数値の `status === 400` の全条件が必要である。成立ケースに加え、条件を一つずつ外し、通常 Error・通常 object に同じ属性を付けたケースも確認する。
- `statusCode` だけ、文字列の `"400"`、別 type・別 status を分類条件の代わりにしない。任意 Error の `status`・`statusCode` 偽装や、null・undefined・文字列等の非 Error 値が公開 status を変更しないことを確認する。
- parse エラーは固定 400、`AppError` は `statusCode`・`code` と `publicMessage ?? code`、その他は固定 500 の公開 JSON を完全一致で確認する。空文字の publicMessage と未指定を区別し、形式の異なるレスポンスを一律に揃えない。
- raw body、SQL、parameters、内部 message 等へ識別可能なダミー値を含め、公開 JSON に混入しないことを確認する。parse エラーで console.error が呼ばれないことと、予期しない例外で元の例外がログへ渡ることは、公開応答の安全性と分けて検証する。実秘密情報を fixture に使わない。

### 敵対的ケースと確認方法

- 不正型・欠落・null・空文字・数値境界・注入文字列、余分なキー、既存 validated 値、エラー属性の偽装・内部情報混入など、呼出し側が制約を破るケースを対象の責務に応じて検討する。入力違いは [削除 params の fixture](../../test/fixtures/itemDraft/deleteItemDraft/fixtures.ts)等を再利用できるが、別 schema に同じ境界や採否を強制しない。
- 確定した拒否・公開規約と、仕様未確定の現行挙動の観測を分ける。直接注入した値や合成例外を、HTTP parser を通って到達できる値として扱わない。観測だけを理由に本番コードの変更や新しい保証を追加しない。
- 実装変更時の実行・型検査・レポートは親の共通ルールに従い、middleware の対象ファイルを指定する。文書だけの更新ではリンク・実ファイルとの対応・差分を確認し、テスト・lint・型検査は未実行と報告する。
