# server 全体で無効化された no-explicit-any ルールを復元する

## 原因

PR #77 で追加された `server/eslint.config.mjs` の `src/**/*.ts` 向け設定に、`"@typescript-eslint/no-explicit-any": "off"` が指定されている。

この設定により、server 配下の本番コードへ新たに `any` を追加しても `npm run lint` で検知できない。プロジェクト規約の「`any` は可能な限り使用しない」「型エラー回避目的だけの `any` を禁止する」に反する。

## 修正方針

`@typescript-eslint/no-explicit-any` の全体無効化を削除し、lint で `any` を検知できる状態へ戻す。

既存の `any` がある箇所は、具体的な型・`unknown`・ライブラリ提供型へ置き換えられるかを個別に判断する。置換できない場合も、ルールの全体無効化ではなく、必要性を説明できる限定的な対応を検討する。

## 対象ファイル

- `server/eslint.config.mjs`
- lint で指摘される `server/src/**/*.ts`

## Codexへそのまま渡せる実装プロンプト

```
`/server` 配下の AGENTS.md と、変更対象ディレクトリの AGENTS.md を確認してください。

`server/eslint.config.mjs` で server 全体に設定されている `@typescript-eslint/no-explicit-any: off` を削除し、`any` を lint で検知できる状態へ戻してください。

その後 `npm --prefix server run lint` を実行し、指摘された `any` を個別に確認してください。具体的な型、`unknown`、ライブラリの型へ置き換えられる箇所は、処理内容を変更せずに修正してください。ルールの全体無効化、安易な eslint-disable、型エラーを隠すためだけの型アサーションは行わないでください。

変更後は `npm --prefix server run lint` と `npm --prefix server run typecheck` を実行し、結果を報告してください。
```

## 完了条件

- 既存の explicit any を分類する
- 置換可能な箇所を修正する
- 残存箇所には必要性をコメントまたは限定的な eslint 設定で明示する
- `@typescript-eslint/no-explicit-any` を error に戻す
