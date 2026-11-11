# getCartItemList テストレポート

## 最新結果

2026-11-11。GET /api/cart/item-listを実装し、[詳細設計](../../../../../docs/design/backend/detail/cart/getCartItemList.md)・[テスト設計](../../architecture/cart/getCartItemList.md)と照合した。
対象7ファイル、計136件成功（単体79、HTTP/登録35、実DB22）。最終結果に失敗・skip・todo・未処理例外なし。必須ケースの未実装・未実行なし。カバレッジ計測は未実施。
既存cart追加・削除・状態取得のHTTP接続と一覧専用枠の独立もH13で成功。本番型検査、全テスト型検査、通常lint、対象test/** TSの追加lint、差分検査成功。
既存処理との共通化、normalizeJapaneseの変更、フロント変更、Model/DBスキーマ変更、migration・syncの実行は行っていない。

## 成果物・境界

パスはserver/基準。routes/cart.tsから認証→専用レート制限→query検証→controllers/cart/cart.tsへ接続。usecases/cart/getCartItemList.tsで入力正規化・検索条件・公開項目選択・ページ数算出・managed transactionを担当し、services/cart/query.tsで本人Cartの一覧/countとREAD ONLY設定を行う。
validators/query/cart.tsとtypes/serviceType/cart.tsに対応するschema/型を追加した。

| ファイル | ケース | 成功件数 | 保証 |
| --- | --- | ---: | --- |
| src/validators/query/test/getCartItemList.test.ts | V01〜V03 | 40 | page境界・型、keyword trim/null/長文/不正型、status、未知キー |
| src/controllers/cart/test/getCartItemList.test.ts | C01〜C03 | 7 | 認証IDと検証値、余剰項目非公開、成功/失敗待機、元例外と送信失敗の伝播 |
| src/usecases/cart/test/getCartItemList.test.ts | U01〜U04 | 25 | 現行正規化、ILIKE文字検索、同一where/transaction、停止/待機、公開項目、nullable/0/false、ページ数 |
| src/services/cart/test/getCartItemList.test.ts | S01〜S04 | 7 | 本人条件、最小取得列、INNER/LEFT、順序、count、READ ONLY固定SQL、元例外 |
| test/integration/usecases/cart/getCartItemList/route.test.ts | H01〜H08・H10〜H14 | 34 | HTTP契約・実JWT/認証/検証/レート制限、既存3経路の回帰 |
| test/integration/usecases/cart/getCartItemList/registration.test.ts | H09 | 1 | 実registerRoutesと対象Routerで/api/cart/item-list到達 |
| test/integration/usecases/cart/getCartItemList/database.test.ts | D01〜D07 | 22 | 本人限定、検索・記号・status・関連・順序・ページング、読取り専用snapshot |

単体では対象層を実行して依存先をモックした。HTTPは実parser・JWT・認証・rateLimit/store・schema・controller・errorHandlerを通し、全cart usecaseと対象外管理者認可をモックした。登録テストは実registerRoutesとCartRouter、対象外Router/認証/usecaseはモック。実アプリ全体のcron等は起動していない。
DBは実usecase・service・Model・PostgreSQLを実行し、D05の実SELECT後にgate、D06では対象serviceへ実UPDATEを注入した。モックの成功を実DB成功とせず、実COMMIT通信断のrollbackや本番DB反映状態も保証しない。

## 実行コマンドと結果

実行ディレクトリ: /home/conta/project/server。

```bash
npm run test:run -- src/validators/query/test/getCartItemList.test.ts src/controllers/cart/test/getCartItemList.test.ts src/usecases/cart/test/getCartItemList.test.ts src/services/cart/test/getCartItemList.test.ts test/integration/usecases/cart/getCartItemList/route.test.ts test/integration/usecases/cart/getCartItemList/registration.test.ts
npm run test:run -- test/integration/usecases/cart/getCartItemList/database.test.ts
npm run test:run -- test/integration/usecases/cart/getCartItemList/route.test.ts test/integration/usecases/cart/getCartItemList/registration.test.ts
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

統合後の第1コマンド: `Test Files 6 passed (6) / Tests 114 passed (114)`。
実DB: `Test Files 1 passed (1) / Tests 22 passed (22)`。
F2修正後の第3コマンド: `Test Files 2 passed (2) / Tests 35 passed (35)`。再実行分は136件へ重複加算していない。
F2修正後のlint・本番typecheck・test/tsconfig.jsonの型検査は終了コード0。本番型検査はsrc/**/testを除外し、テスト型検査で単体・結合を含めて確認した。
通常lint対象外の新規test/** TS 5ファイルを次の一時コマンドで追加検査し、`files:5, errors:0, warnings:0`。共有設定は変更していない。

```bash
node --input-type=module <<'JS'
import { ESLint } from 'eslint';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
const lint = new ESLint({ overrideConfigFile: true, overrideConfig: tseslint.config({
  files: ['test/**/*.ts'], extends: [eslint.configs.recommended, ...tseslint.configs.recommended]
}) });
const results = await lint.lintFiles(['test/fixtures/cart/getCartItemList/*.ts', 'test/integration/usecases/cart/getCartItemList/*.ts']);
process.stdout.write(await (await lint.loadFormatter('stylish')).format(results));
const errors = results.reduce((n, r) => n + r.errorCount, 0);
const warnings = results.reduce((n, r) => n + r.warningCount, 0);
process.stdout.write(JSON.stringify({ files: results.length, errors, warnings }) + '\n');
if (errors || warnings) process.exitCode = 1;
JS
```

## 実DBの安全条件と結果

test/fixtures/cart/getCartItemList/databaseSetup.tsがDB import前にserver/.env.testを読み、NODE_ENV=test、PostgreSQL URLのDB名test_dbを検査。親processの接続情報にはfallbackせず、dotenv別envアクセスと検証後の差替えを拒否する。
アプリsequelize、models/index.ts内sequelize、observerの全3接続で設定DB名とSELECT current_database()=test_dbを確認した。全接続の検査完了後だけseedを許可した。
Cart/Item/Video/Sale/UserのModel全列存在・NULL制約、Itemのid/price/uploaded_at/search_text型、Cartのid/item_id/user_id/createdAt型、Item.status ENUM、Itemのseller/video/sale FK、Cartのuser/item FKと更新/削除CASCADEを検査して成功した。本番DBのメタデータは未確認。

- D01/D02/D03/D04/D07: 新規SELECTによる自作全行snapshotで、取得後も対象・非対象・他ユーザー・関連行が不変。21件の2ページと範囲外、20件の1ページ、0件、両statusを確認。
- D05: 実transaction_isolation=repeatable read、transaction_read_only=on、observerとの異なるPIDを確認。実一覧SELECT後に独立observerで自作Cartを削除commitし、当該応答は旧一覧・旧countを保持、次要求は空、Itemは維持された。読取りは更新をブロックするロックを設けないため実ロック待機を保証対象としない。
- D06: READ ONLYの実UPDATE拒否（SQLSTATE 25006）、count未実行、対象・非対象を含む自作行不変、次要求の成功を確認。
- afterCreate hookでCart/Item/Video/Sale/Userの作成IDを追跡。gateとPromise回収後、Cart→Item→Video→Sale→Userの順に自作ID限定で削除し、各モデル残存0件を確認した。
- hook/spy解除、全3接続close成功、env復元を確認。DB作成・migration・sync・TRUNCATE・全件削除・sequence巻戻しなし。

## 初回失敗・修正・再検証履歴

すべて2026-11-11。同日の実行順で以下を記録する。

| ID | 元ケース・対象 | 初回結果・原因 | 修正と再検証 |
| --- | --- | --- | --- |
| F1 | 本番型検査、rateLimit/cartRateLimit.ts | req.userの直接参照でTS2339。ライブラリ側Request型には認証拡張がない | 規約どおりAuthUser境界の型変換へ修正。API契約変更なし。本番/テスト型検査・HTTP成功 |
| E1 | HTTP/登録、H01〜H14 | 担当worktree初回はsandbox listen EPERM、35件失敗・35件未処理例外 | 同じコマンドを承認手順で制限外再実行し35件成功。root統合後の114件とF2後35件も成功、未処理例外なし |
| E2 | DB、D01〜D07 | 初回setupで127.0.0.1:5432接続EPERM、1 suite失敗・22 skipped。本体未実行・seed/cleanup DELETEなし | 同じガード/接続先のまま承認手順で制限外再実行し22件成功。ガード・cleanup・全接続closeも成功 |
| F2 | ルートレビュー、H09/H13、routes/cart.ts | 本番実装時の追記で旧GET /:id/status末尾にも一覧controllerを登録していた。旧controllerがnextしないためHTTP上は顕在化せず、ソースレビューで検出 | 余分な登録を削除。既存経路の元の定義を維持し、新APIへだけ接続。HTTP/登録35件と全静的検査を再実行し成功 |

詳細設計の検索記号本文とコード例、seller_id/Cart/offset表記、検査実施済みとの先行記述も修正した。検索語の変換はユーザー回答に従い既存normalizeJapaneseを変更せず使用し、ILIKE文字検索を維持した。
未解決の失敗・仕様確認待ち・必須検証の残件なし。対象外の状態遷移・通知/S3・実COMMIT応答喪失・本番環境検証は実施していない。
