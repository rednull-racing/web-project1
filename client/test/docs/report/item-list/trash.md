# 削除した商品一覧 テストレポート

実行日：2026-11-12。対象 `/item-list/trash`。[設計書](../../architecture/item-list/trash.md)に対応。本文のパスは原則client基準、E2Eはリポジトリルートのtest基準。Node.js26.12.1、Vitest5.0.5を使用。

## 最新結果

単体4ファイル34件、結合2ファイル15件は統合後の実行ですべて成功。実E2E（Chromium）も2 spec・5件すべて成功、合計54件成功。自動Vitestの失敗・pending/skip・todo・未処理例外0。対象eslint・テスト用型検査も成功。本番修正は不要で変更していない。目視O01は未実行・人間確認待ち。

## 検証境界

単体は対象本体を実行しSWR・子・日時等の依存を境界モック。U-I03は実ItemPriceで数値/文字列価格とnull非許容型を確認。結合は実SWR・共通fetch・実一覧/行/共通UI、HTTP MSW・認証token取得・画像最適化・Next router等の境界を制御する。JSONはwrapped配列、数値ID、ISO日時を維持。画面を通すためにAPI構造を変換しない。

実通信・実認証・DBの保証はE2Eと区別する。共通部品の全分岐・既存全単体回帰は今回対象外。O01は担当「人間」、状態「人間確認待ち」。実レイアウト、フォーカス、実遷移やブラウザー差の目視を自動成功に含めない。カバレッジ未取得。本番仕様を変える修正は行わない。

## 修正案

### F1：説明文と取得期間の不一致（提案のみ）

metadataは「最近1か月以内」だが、現行getItemTrashListのwhereに期間条件はなく、前後ページも全本人データを取得する。ページAGENTSにも差が記載済み。説明文を実際の取得条件に合わせるか、バックエンドへ期間制限を追加するかの判断が必要。いずれも公開説明または取得仕様の変更なので実行しない。E-X01は期間制限なしというAPIの現状を観測するケースであり、説明文の妥当性を成功とするものではない。

### F2：全体静的検査の既存診断（対象外・提案のみ）

全体lintは既存23 errors/34 warnings（refsのrender参照、effect内setState、宣言前参照、any等）。本番型検査は既存ページの同期params/searchParamsとNext生成型の差、upload/okのItem.seller_id不存在で失敗。該当ページの実契約へ型・参照を個別に整合し再検査する。ルール無効化や共有設定変更で通さず、今回は修正しない。

### 未確定事項

trash価格nullは以前のユーザー指示により許容しない。モデルはnullableだが、フロントへ「-」補完を追加していない。null実データ発生時はAPI/データ保証側との契約確認が必要で、新しい表示仕様を独断で追加しない。

## 単体・結合の実行とケース対応

client/でNode26のbinをPATH先頭に指定して実行：

```bash
npm run test:unit -- src/app/item-list/trash/test/ src/app/item-list/trash/api/test/ --reporter=json --outputFile=/tmp/trash-final-unit.json
npm run test:integration -- test/integration/components/item-list/trash/ test/integration/pages/item-list/trash/ --reporter=json --outputFile=/tmp/trash-final-integration.json
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
./node_modules/.bin/eslint src/app/item-list/trash/test src/app/item-list/trash/api/test test/fixtures/item-list/trash test/integration/components/item-list/trash test/integration/pages/item-list/trash
npm run lint
npm run typecheck
```

JSONと `/tmp/trash-final-{unit,integration}.log` は一時成果物。下記は実ファイルのassertionResultsから集計、describe数や再実行を重複加算しない。

| ファイル（client基準） | 実行 | 成功 | 失敗 |
| --- | --- | --- | --- |
| `src/app/item-list/trash/test/page.test.tsx` | 1 | 1 | 0 |
| `src/app/item-list/trash/test/trashItem.test.tsx` | 4 | 4 | 0 |
| `src/app/item-list/trash/test/trashItemList.test.tsx` | 13 | 13 | 0 |
| `src/app/item-list/trash/api/test/client.test.ts` | 16 | 16 | 0 |
| `test/integration/pages/item-list/trash/page.test.tsx` | 3 | 3 | 0 |
| `test/integration/components/item-list/trash/trashItemList/integration.test.tsx` | 12 | 12 | 0 |

| 設計ID | 展開件数 | 結果 |
| --- | --- | --- |
| C-E01 | 1 | 成功 |
| C-E02 | 4 | 成功 |
| C-E03 | 1 | 成功 |
| C-N01 | 4 | 成功 |
| C-N02 | 1 | 成功 |
| C-N03 | 1 | 成功 |
| P-N01 | 1 | 成功 |
| P-N02 | 2 | 成功 |
| U-A01 | 10 | 成功 |
| U-A02 | 6 | 成功 |
| U-I01 | 1 | 成功 |
| U-I02 | 1 | 成功 |
| U-I03 | 2 | 成功 |
| U-L01 | 5 | 成功 |
| U-L02 | 1 | 成功 |
| U-L03 | 2 | 成功 |
| U-L04 | 3 | 成功 |
| U-L05 | 2 | 成功 |
| U-M01 | 1 | 成功 |

U-L04はclearで先に検索解除せず選択置換し、空白条件自体を検証。U-I03のnull価格非許容はexpectTypeOfで型契約を確認。C-N01の4条件はnumber/stringの12345と0、後2条件でnullable文字列・画像を確認。正規GET/Bearer/数値ID href/ISO日時を維持し、変更系HTTPは使っていない。C-E02は4障害注入後に新cacheでremountし回復を確認し、既存画面に再試行UIがあるとは扱わない。C-E03はfinallyで保留を解放。P-N01は実枠と一覧を接続し、BackのSVGは属性で限定取得してrouter.back要求を確認。

初回結合C-N01は旧￥表記を誤って期待した4件が失敗。現行AGENTSとItemPriceの確定仕様「12,345円」を根拠にテストだけを訂正し、再実行後すべて成功。期待値の訂正は本番仕様変更ではなく、過去件数を最終集計に加算していない。単体は初回から成功。

対象eslintは診断0（`/tmp/trash-final-target-lint.log`）、テスト用型検査は診断0（`/tmp/trash-final-test-types.log`）。全体lintは23 errors/34 warnings（`/tmp/trash-lint.log`）、本番型検査は既存診断で失敗（`/tmp/trash-types.log`）。対象診断0と全体成功を分ける。本番tsconfigはsrc内testも含み、テスト用は結合/設定等も含む。対象TSXは通常lintにも含まれる。

## E2Eの実行・結果

Node26.12.1、production Next16.2.2（Webpack）、実NextAuth、実Express auth/item-trashルーター、PostgreSQL test_db、Chromiumで実行。業務APIモック・JSON変換・ルート補正なし。trash/user専用ガードが実DB名とモデル列を検査してseed前に停止可能とし、無関係なdraft/editing schemaを要求しない。

| 設計ID | 実装・実行結果 | 根拠 |
| --- | --- | --- |
| E-N01 | 1件成功 | A21/B1/owner null1を準備、本人20件とtotalPages2、DBのcreatedAt/id降順、全20行の名前・価格・hrefを照合 |
| E-N02 | 1件成功 | page2残1件、name/title/0件/%文字検索のJSON・DB照合、DB不変 |
| E-S01 | 1件成功 | sessionなしlogin、実認証後token除去のGET401・保護情報なし、DB不変 |
| E-S02 | 1件成功 | seller_id=Bを指定してもA本人だけ、他人/owner null除外、件数とDB不変 |
| E-X01 | 1件観測成功 | 45日前の本人行も取得。F1の仕様差が解消したとは扱わない |

全自動ケースは実装・実行済み。未実装・未実行・中断・skip0（最終結果）。O01の人間観測は別の未実行事項。E2Eは2 specの実結果から5件を集計し、先行試行と加算しない。Firefox/WebKitは目視O01担当で今回自動実行していない。

ファイルはリポジトリルート `test/E2E/item-list/trash/{getItemTrashList,authorization}/flow.spec.ts` と `test/fixtures/item-list/trash/{database.ts,harness.ts,serverProcess.mjs,README.md}`。fixtureは作成IDと所有者を追跡し、finallyで作成refresh_tokens/trash/userだけcleanup、Next/Expressを停止した。DB更新はテストseed/cleanupのみ、migration・sync・本番修正なし。

client/でビルド：

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:4321/api API_URL=http://127.0.0.1:4321/api npm run build -- --webpack
```

test/で実行：

```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=/tmp/trash-e2e-results.json npm run test:e2e -- E2E/item-list/trash/ --project e2e-chromium --reporter=list,json
npm run typecheck
```

Node26のPATHを設定。専用Next3021/Express4321はharnessで起動し、秘密設定は.env.testから非表示で渡す。詳細は専用fixture README。ビルドとE2E実行は権限を変えて再試行した。集計JSON `/tmp/trash-e2e-results.json`、出力 `/tmp/trash-e2e-run.log`、ビルド `/tmp/trash-e2e-next-build-escalated.log` は一時成果物。

E2E型検査は統合後も成功（`/tmp/trash-final-e2e-types.log`）。追加eslintはclient既存設定を明示して専用E2E/fixtureのTS/mjsを検査し成功（`/tmp/trash-e2e-lint.log`、React/pages検出noticeのみ）。共有設定変更なし。

履歴：sandbox内DB接続はEPERM、権限変更後に接続とschema確認が成功。Turbopackの依存symlink root制約はCLI --webpackで回避し、権限変更後にproduction build成功。初回実認証は長いfixtureメールでNextAuth401/direct login500となり、通常ケース用メールを短くして認証成功。JWTがrefresh_tokens.tokenの255文字を超える可能性を長さだけで調査し、token値は出力していない。長いメールでの本番認証問題は原因未確定の調査候補として残し、authコードやDB列は変更していない。

認証通過後の初回E-N01はテスト側の旧￥価格期待で失敗したため、現行確定仕様の円表示へ訂正。テスト型検査のResponse.ok()誤用もokプロパティへ訂正し解消。最終の全5件成功と区別して履歴を残す。期待値変更は仕様の根拠によるテスト修正であり、本番仕様変更ではない。

自動検証は完了したが、F1の説明文/期間契約、F2の対象外静的診断、価格nullの未確定事項、O01と長いメールでの認証調査は別の残件。本番変更を伴う修正案は実施していない。
