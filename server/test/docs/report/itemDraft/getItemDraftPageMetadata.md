# getItemDraftPageMetadata 統合レポート

実行日: 2026-10-30（JST）。[詳細設計](../../../../../docs/design/backend/detail/itemDraft/getItemDraftPageMetadata.md)、[テスト設計](../../architecture/itemDraft/getItemDraftPageMetadata.md)に対応する。パスとコマンドの実行ディレクトリはserver/基準。Node.js v22.22.2で実施し、指定Node26は未確認。カバレッジは取得していない。

## 最新結果

`GET /api/item-draft/:id/metadata` を認証・所有者条件付きで追加。公開JSONは `{ itemDraft: { id, name } }` のみ、保存nameのnull/空文字/空白を保持する。レート制限はユーザー回答の1分120回。設計書の二重拡張子・コピー元の処理名/成果物パス/関連取得の記述を修正した。

- 実DB D01〜D05は1ファイル11件成功、失敗・skip・未処理例外0。所有者条件・公開列・nameの保存値・反復/並行読取・削除後404・非対象不変を確認。
- server通常lint、本番typecheck、テストtsconfigは成功。
- 新規単体19件（service3/usecase10/controller6）＋HTTP63件＝82件成功。既存回帰355件を含む統合後の最終実行は21ファイル437件成功、失敗・skip・未処理例外0。DBと重複しない対象合計93件、回帰込み448件。
- 通常対象外のテスト/fixture8TSとE2E/fixture2TSの追加ESLintは各0error/0warning。

## DB検証と実行

```bash
PATH=/home/conta/.nvm/versions/node/v22.22.2/bin:$PATH npm run test:run -- test/integration/database/itemDraft/getItemDraftPageMetadata/ --maxWorkers=1
```

1ファイル11件成功（14:19:38 JST、2.71s）。D01×1/D02×4/D03×3/D04×2/D05×1。共有基盤のhook干渉防止のため1worker。専用databaseFixturesは既存getItemDraftPage基盤を再利用し、DB import前に.env.test由来のNODE_ENV=test/PostgreSQL/test_dbを検査。app/models/observer/competitorの全4接続で接続前設定DB名と接続後current_databaseを検査し、item_draft列・型・NULL・FKとfixture関連スキーマを照合後にseedした。Model/migrationの存在を適用済みの証拠とはしていない。

対象・別下書き・他人・編集・商品・マスターを新規SELECT snapshotで比較。name255文字を含む保存値保持、他人/不存在/seller_id=nullを同一404、反復と別対象並行を確認。D05だけfixture自身を明示削除し再取得404。API自身は書き込まない。全自作IDの追跡・FK順ID限定cleanup・残存0・hook解除・全接続close・env復元が成功した。migration/sync/全件削除/sequence巻戻しは行っていない。

## 静的検査

Node22のPATH指定で `npm run lint`、`npm run typecheck`、`./node_modules/.bin/tsc --noEmit -p test/tsconfig.json` はexit0。DB担当の追加2TSは既存ESLint/typescript-eslint recommendedによる追加検査0error/0warning。共有設定の変更なし。

## 実行履歴・修正

- ENV-DB: 初回sandboxのconnect EPERMでsuite setup失敗、11skip（本体未実行）。ガード中のため書込み・cleanup DELETEなし、接続closeを実施。承認後、同じ.env.testガード・同じ対象コマンドで11件成功。
- ENV-HTTP: 初回listen EPERMでHTTP57件失敗・57例外。承認後に同一対象を再実行し解消。初回単体19件＋HTTP57件の再実行は4ファイル76件成功。
- CMD-01: 親の静的検査を誤ってrootで実行しrun-p未導入で停止。server/の `npm run lint` で実行し直し成功。本番/共有設定は変更していない。

単体はModel/service/usecaseを各境界でモックし、実SQL/HTTP認証の保証と区別する。HTTPは最小Expressで実parser/認証/Router/制限/schema/controller/errorHandlerを接続、usecaseと対象外依存をモック。共通prefixはroutes/index.tsと照合し、cronを含む実app全体は起動していない。DBは実usecase/service/Modelを使用。外部送信・更新・transaction/rollback/ロックは本APIの対象外。

## 単体・HTTP・回帰の最終実行

```bash
PATH=/home/conta/.nvm/versions/node/v22.22.2/bin:$PATH npm run test:run -- src/services/itemDraft/test/ src/usecases/itemDraft/test/ src/controllers/itemDraft/test/ test/integration/usecases/itemDraft/getItemDraftPageMetadata/route.test.ts test/integration/usecases/itemDraft/getItemDraftPage/route.test.ts test/integration/usecases/itemDraft/deleteItemDraft/route.test.ts test/integration/usecases/itemDraft/createItemDraft/route.test.ts test/integration/usecases/itemDraft/convertItemDraftVideo/http.test.ts
```

親worktree統合後14:23:26 JST、11.80s、21ファイル437件成功。S01/S02は3件、U01〜U04は10件、C01〜C04は6件、R01〜R08/L01〜L05は63件。既存controller/HTTP7ファイルへ新usecaseの対象外モック境界だけを追加し、実DB初期化への漏れを防止した。HTTPは120回許可/121回拒否、別ユーザー・作成/詳細APIとのstore独立、JWT/IP偽装、失敗要求計上、parser/認証の非計上、窓境界、121並行要求まで確認。元の76件成功後name保持3件/store独立2件/parser非計上1件を補完し、usecaseのfreezeと逆順完了時の異なるnameのassertも補強。期待値の緩和・skip化なし。

フロント切替後の実Next.js→Express→DB検証は[フロントレポート](../../../../../client/test/docs/report/item/itemDraftPage.md)を参照。API設計/実装/単体/HTTP/DBの必須ケースに未解決事項はない。
