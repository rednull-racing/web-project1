# createItemEditingDraftのRouterテストをDB設定から独立させる

## 問題と原因

2026-10-16、統合テストの配置変更後にserver/で次を実行したところ、40件すべてがbeforeEach内のRouter読込みで `DATABASE_URL is not set!` により停止した。HTTPの検証には到達していない。

```bash
npm run test:run -- test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts --maxWorkers=1
```

実controllerがimportする対象外のcreateItemEditingCopyがモックされておらず、`src/usecases/itemEditing/createItemEditingCopy/createItemEditingCopy.ts` → `src/db.ts` に到達する。配置変更では既存の相対参照先を維持し、モック構成は変更していない。DB設定の追加で回避しない。

## 修正内容

`server/test/integration/usecases/itemEditing/createItemEditingDraft/route.test.ts` で、対象外usecaseを現在の実ファイルパスでモックする。実Router・認証・validator・レート制限・共通errorHandlerと対象usecaseの既存モックを維持し、40件のケース・期待値と本番コードは変更しない。

`server/src/controllers/itemEditing/itemEditing.ts` と `server/src/controllers/itemEditing/test/createItemEditingDraft.test.ts` を参照する。server/で上記Routerテスト、lint・typecheck、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` を確認し、結果を記録する。HTTP待受けがサンドボックスで拒否された場合は承認手順に従って再実行する。DB接続・migration実行は不要。

## 解決結果（2026-10-16）

対象外のcreateItemEditingCopyUseCaseを実import先でモックし、既存40件のケース・期待値を維持したまま全件成功した。lint・本番/テスト全体型検査・対象TSの追加lintも成功。本番コード・環境設定は変更していない。

`NODE_ENV=test`は有効で、server/.env.testには正しいキーの`DATABASE_URL`が存在した。ただしdb.tsは.env.test読込み前にprocess.env.DATABASE_URLを検査するため、ファイルに値があっても未設定エラーになる。加えてRouterテストはdotenvを意図的にモックしている。DB初期化順序の改善は [別Todo](validate-test-db-url-after-loading-env.md) に記録した。

詳細は [検証レポート](../../../server/test/docs/report/itemEditing/createItemEditingDraft.md#route-db-isolation-20261016) を参照。DB接続・migrationは実行していない。
