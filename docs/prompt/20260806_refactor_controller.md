# Route・Controller責務分離リファクタ

## 概要

`Route` をルーティング定義のみを担当する層にし、現在Route内に記述されているリクエスト処理をController層へ分離してください。

既存処理の移動を目的とするリファクタです。

処理内容、レスポンス、エラー、URL、middleware、実行順序などの挙動は変更しないでください。

---

## 作業前に読むファイル

作業を開始する前に、必ず以下を確認してください。

- `/AGENTS.md`
- `/server/AGENTS.md`
- `/server/src/routes/AGENTS.md`
- `/server/src/controllers/AGENTS.md`
- `/docs/todo/AGENTS.md`
- 作業対象ディレクトリからルートまでに存在するその他の `AGENTS.md`

また、以下のコーディング規約を確認してください。

- `/docs/codingRule/backend/route.md`
- `/docs/codingRule/backend/controller.md`

---

## 作業範囲

`/server/src/routes` 配下にあるRouteファイルを対象とします。

ただし、以下のファイルはすでにリファクタ済みのため、変更しないでください。

- `/server/src/routes/items.ts`
- `/server/src/controllers/items.ts`

作業対象のRouteファイルに対応するControllerファイルを、`/server/src/controllers` 配下に作成または修正してください。

RouteファイルとControllerファイルは、原則として同じファイル名にしてください。

例：

```text
/server/src/routes/users.ts
/server/src/controllers/users.ts
```

Route 1ファイルに対して、Controller 1ファイルとします。

複数のRouteファイルを1つのControllerファイルへ統合したり、1つのRouteに対して複数のControllerファイルへ分割したりしないでください。

---

## 実装の参考

以下のファイルを実装形式の基準としてください。

- `/server/src/routes/items.ts`
- `/server/src/controllers/items.ts`

既存コードとコーディング規約の間に差がある場合は、AGENTS.mdとコーディング規約を優先してください。

不明点を独自判断で仕様変更せず、既存処理を維持する方向で実装してください。

---

## Routeの実装ルール

Routeには以下のみを残してください。

- HTTPメソッド
- パス
- middleware
- Controller
- Routeの概要を示す3行コメント
- Routerの作成およびexportに必要な処理

Route内に以下を残さないでください。

- `async (req, res, next) => {}` 形式の無名ハンドラー
- `req.params`、`req.query`、`req.body`、`req.user`からの値の取得
- UseCase、Service、Modelの呼び出し
- レスポンス処理
- 条件分岐
- 業務ロジック
- DB操作

URL、HTTPメソッド、middlewareの種類および指定順序は変更しないでください。

Routeのimportは、Controller分離によって不要になったもののみ削除してください。

---

## Controllerの実装ルール

既存Route内の各ハンドラーを、挙動を変えずに対応するControllerへ移動してください。

Controllerは以下を担当します。

- `req.params`、`req.query`、`req.body`、`req.user`から値を取得する
- UseCaseなど既存処理を呼び出す
- HTTPレスポンスを返す
- エラーを`next`へ渡す

Controllerは名前付きexportにしてください。

```ts
export const exampleController = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // 既存処理
    } catch (err) {
        next(err);
    }
};
```

Expressの型はtype importを使用してください。

```ts
import type { NextFunction, Request, Response } from "express-serve-static-core";
```

既存Route内にある以下の内容は、意味や順序を変えずControllerへ移してください。

- 値の取得方法
- 値を取得する順序
- 型アサーション
- デフォルト値
- 条件分岐
- UseCaseなどの呼び出し順序
- レスポンスのstatus
- レスポンスbody
- returnの有無
- エラーの種類
- エラーメッセージ
- TODOコメント
- その他の既存コメント

共通化、関数の抽出、命名の全面変更、型の再設計は行わないでください。

---

## 3行コメント

Route処理の上に既存の3行コメントがある場合は、そのコメントをそのままControllerの対応する処理の上にもコピーしてください。

3行コメントはRoute側にも残してください。

コメント内容はRouteを正とし、Controllerや他のファイルに同じ処理を示す異なるコメントがある場合は、Routeのコメントに合わせてください。

Routeに3行コメントが存在しない処理については、新規作成しなくても構いません。

---

## 挙動維持

この作業では責務の移動のみを行ってください。

以下は禁止します。

- API仕様の変更
- URLの変更
- HTTPメソッドの変更
- middlewareの追加、削除、並び替え
- バリデーション方法の変更
- UseCaseやServiceの設計変更
- DBクエリの変更
- レスポンス形式の変更
- status codeの変更
- エラー処理の仕様変更
- 変数名や関数名の不要な変更
- 共通Controllerや共通関数の新規作成
- 関係のないリファクタ
- 関係のないフォーマット変更
- `items.ts`の変更

既存コードに問題があっても、今回の作業内では修正しないでください。

---

## Todoへの記録

作業中に、今回の責務分離とは無関係な以下の内容を発見した場合、その場では修正しないでください。

- バグ
- エラー
- セキュリティ上の問題
- 改善案
- リファクタ候補
- 技術的負債

`/docs/todo/AGENTS.md`のルールに従い、適切な優先度フォルダへMarkdownファイルとして記録してください。

Todoには少なくとも以下を含めてください。

- 優先順位
- 問題の概要
- 原因
- 修正方針
- 対象ファイル
- Codexへそのまま渡せる実装プロンプト

既存のTodoと同一内容のものは重複して作成しないでください。

---

## 動作確認

実装後、可能な範囲で以下を実行してください。

```bash
npm --prefix server run lint
npm --prefix server run typecheck
```

テスト用scriptが存在し、今回の変更に対応するテストを実行できる場合は、そのテストも実行してください。

既存エラーによってコマンドが失敗した場合は、今回の変更によるエラーか、既存エラーかを区別して報告してください。

今回の作業範囲外のエラーは修正しないでください。

---

## 最後にセルフレビュー

実装完了後、以下を確認してください。

- AGENTS.mdとコーディング規約を順守しているか
- Routeにはルーティング定義以外が残っていないか
- Routeの無名ハンドラーがすべてControllerへ移動されているか
- Route 1ファイルに対してController 1ファイルになっているか
- `routes/items.ts`と`controllers/items.ts`の書き方から不必要に逸脱していないか
- URL、HTTPメソッド、middlewareの順序を変更していないか
- レスポンス内容やエラー処理を変更していないか
- 3行コメントがRouteとControllerの両方に存在するか
- 不要になったimport以外を変更していないか
- 指示した内容以外の変更がないか
- `items.ts`を変更していないか
- lintおよびtypecheckで今回の変更による新規エラーが発生していないか

---

## 完了報告

最後に以下を報告してください。

1. 変更したRouteファイル
2. 作成または変更したControllerファイル
3. 作成したTodoファイル
4. 実行した確認コマンドと結果
5. セルフレビューで確認した内容
6. 未対応事項や判断に迷った箇所
