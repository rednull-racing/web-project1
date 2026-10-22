# バックエンド依存パッケージ脆弱性調査（2026-10-22）

最新状況: 2026-10-22に依存脆弱性を修正。全依存34件・本番依存25件から、いずれも0件へ減少した。
[修正内容・検証結果](#2026-10-22-修正結果)を参照。以下の初回調査は修正前の履歴として保存する。

## 結論

全依存34件、本番依存25件を再現した。最優先は、実際の公開APIで解析処理を使うMulter 2.1.1の更新。
Critical 7件を「公開APIで成立する7種類の攻撃」とは解釈できない。旧ORMを内包するマイグレーションツール、
呼出しが見つからないEJS、設定依存のproxy-addrが含まれる。
今回は調査のみ。package.json・lockfile・本番コードは変更していない。修正・互換性検証は残件。

## 調査条件と証跡

- 対象コミット: `6dd2460a22168106e633713e3c85b680ec31cbd3`。
- Node.js 26.12.1 / npm 11.20.0で、serverディレクトリから下記を実行した。
- `npm audit --json` → [全依存の原本](audit-full.json)、`npm audit --omit=dev --json` → [本番依存の原本](audit-production.json)。
- 両auditの終了コード1は脆弱性検出によるもの。JSONに通信エラーなし。
- `npm ls --all --json`は終了コード0。[検出パッケージの依存経路](dependency-paths.json)を抽出し、lockfileと照合した。
- `npm view`で修正版候補の存在、Express/Sequelize/tsc-aliasの依存範囲を確認した。
- npm auditの件数は脆弱性を持つパッケージ名の集計。親パッケージへの波及、同名の複数バージョンを含み、固有GHSA数や悪用可能数と一致しない。
- auditはレジストリ情報・lockfileの照合。稼働中EC2のイメージ、NGINX設定、実際の通信経路は未確認。実環境への攻撃検証は未実施。

| 対象 | Critical | High | Moderate | Low | 計 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 全依存 | 7 | 16 | 8 | 3 | 34 |
| 本番依存（omit=dev） | 7 | 11 | 5 | 2 | 25 |

Dockerfileは本番段でも`npm ci --omit=dev`を行うため、dependenciesに置かれたマイグレーション・ビルド用ツールも本番イメージに残る。
本番にインストールされることと、HTTPリクエストから実行されることを区別して評価した。

## 実行時依存の評価

### 1. Multer（対応優先度: 最優先）

`multer@2.1.1`は5アドバイザリの対象。細工したmultipartフィールド名によるプロセス停止、深いフィールド名、
中断アップロードの後処理、配列index、非同期fileFilter使用時の制限回避が報告されている。
[代表アドバイザリ](https://github.com/advisories/GHSA-wc9g-mqfw-jrwm)の修正版は2.3.0。

`src/middleware/multipart.ts`がmemoryStorageとupload.fieldsを利用し、ファイルサイズ10MiBを設定している。
サイズ制限だけではフィールド名解析の問題を解消しない。非同期fileFilterは現在設定されていない。
`src/routes/shopSignup.ts`の`PATCH /api/shop-signup/:id/id-card`では、id検証後にmultipart解析を実行し、
認証とsignup3RateLimitは解析後となる。正常形式のidを用いれば、未認証でも問題の解析に到達し得る。
`idCard.ts`では認証が先行するが、ショップ登録側の到達性は残る。

更新候補: 2.3.0以上の修正版。既存`^2.1.1`の範囲内。更新後は正常アップロード、異常フィールド、中断、サイズ上限、
ファイル数上限、エラー応答を確認する。認証・レート制限と解析の順序は、各ルートの契約を確認して対処を判断する。

### 2. Express配下（同じ作業で更新候補）

- `proxy-addr@2.0.7` / Critical: [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h)。特殊なIPv4-mapped IPv6信頼サブネットの指定が成立条件。
  `src/app.ts`は`trust proxy = 1`というhop数指定で、そのサブネット設定は確認できない。当該Criticalの成立は未確認。
  修正版2.0.8はExpress 4.22.1/4.22.3の`~2.0.7`範囲内。hop数設定自体の安全性は実際のプロキシ構成に依存し、本調査では断定しない。
- `body-parser@1.20.4` / Low: [不正limitによるサイズ制限無効化](https://github.com/advisories/GHSA-v422-hmwv-36x6)。
  app.tsはjson/urlencodedのlimitを独自指定していないため、不正limitという条件は確認できない。候補1.20.6。
- `qs@6.14.2` / Moderate: [comma指定時の配列上限回避](https://github.com/advisories/GHSA-x5fp-wj9c-mxmx)、
  [stringify時のisBuffer例外](https://github.com/advisories/GHSA-4mjr-xmp4-gh2g)等。
  Expressのqueryとbody-parserはallowPrototypes=trueでparseするが、comma=trueの指定、parse後のqs.stringify経路は現行srcに見つからない。
  単にquery/bodyをparseするだけで全アドバイザリが成立するとは判断しない。候補6.16.0。

Express 4.22.3はqsを`~6.16.0`へ更新している。4.22.1のqs指定は`~6.14.0`なので、子依存の通常更新だけでは6.16.0へ上がらない。
Expressは4.22.3を候補とし、proxy-addr/body-parserも修正版へ解決されたことをlockfileで確認する。
Express 5への移行はこの修正の前提ではない。候補バージョンでの動作検証は未実施。

### 3. レート制限・ログ

- `express-rate-limit@8.5.1 → ip-address@10.2.0` / High: 分類・サブネット判定の誤り、Address6の長大入力によるDoS。
  [長大入力の修正版](https://github.com/advisories/GHSA-h3mg-xc3c-68pw)は10.7.1。
  ログイン等のデフォルトIPキー経路で使われるが、ライブラリはnode:netのisIPv6で検証してからAddress6を生成する。
  srcにip-addressの直接呼出しは見つからず、長大な任意文字列がそのままAddress6に渡る経路は確認できない。
  その他のIP分類問題の各関数も同一視しない。`^10.2.0`範囲内で10.7.1以上へ更新しIPv4/IPv6のキー・制限動作を検証する。
- `morgan@1.9.1 → on-headers@1.0.2` / Moderate・Low: ログ偽装とヘッダー操作。
  app.tsでlogger('dev')を全リクエストに適用する。[ログ偽装](https://github.com/advisories/GHSA-jxfw-x594-9x9m)は利用token・入力・ログ処理側に依存する。
  dev形式に存在しないremote-user/引用符フィールド等の問題まで成立済みとしない。候補morgan 1.12.1（同じmajorだが、現行`~1.9.1`の範囲外）。
  on-headersも1.1.0以上へ解決されたことを確認し、ログ行とレスポンスヘッダーの回帰を検証する。

### 4. EJS・現行Sequelize

- `ejs@2.6.2` / Critical: [テンプレートオプション注入](https://github.com/advisories/GHSA-phwq-j96m-2c2q)と汚染対策不足。
  app.tsのview engine設定はあるが、srcにres.render等の呼出し・EJSテンプレートは見つからない。HTTP経由の実行到達性は未確認。
  不要と確定すれば依存と設定を削除する候補。必要なら少なくとも両指摘の修正を含む3.1.10以上でテンプレートを検証する。
  auditの自動提案は7.0.2であり、無検証のmajor更新を採用しない。
- 現行`sequelize@6.37.8`のSQL注入等の直接アドバイザリは、いずれも6.37.8未満の影響範囲。
  同名の旧4/5系やuuidへの依存がauditのsequelize集約項目に含まれるため、「現行6.37.8がCritical SQL注入対象」とは読まない。
- `sequelize@6.37.8 → uuid@8.3.2` / Moderate: [外部出力buffer付きv3/v5/v6の境界検査不足](https://github.com/advisories/GHSA-w5hq-g745-h8pq)。
  現行Sequelize lib内で確認できる呼出しはv1/v4で、該当v3/v5/v6経路は見つからない。修正版uuid 11.1.1は親の`^8.3.2`範囲外。
  最新Sequelize 6.37.8も同じ範囲指定なので、通常更新では解決しない。major overrideやORM移行は互換性調査を別途行う。
- `sequelize → moment@2.30.1` / Moderate: [非文字列locale値のパストラバーサル](https://github.com/advisories/GHSA-4p3w-j4w9-5jqw)。
  srcと現行Sequelize libにlocale呼出しは見つからない。修正版2.31.0は親の`^2.29.4`範囲内。
  `validator@13.15.26`（現行6系配下）は今回の検出対象外。Highのvalidatorは旧マイグレーションツール配下の10.11.0。

## マイグレーション・ビルド・開発依存

1. `sequelize-auto-migrations@1.0.3 → sequelize@4.44.4`は旧SQL処理・validator@10.11.0・uuid@3.4.0を取り込む。
2. `sequelize-typescript-migration@0.0.1-beta.3 → sequelize@5.22.5 / sequelize-typescript@1.1.0 / mysql2@2.3.3`はSQL処理・prototype pollution・MySQL RCE等を取り込む。
   `src/db.ts`はPostgreSQLで、srcにmysql2の直接importは見つからない。MySQLプロトコルのRCEがHTTPから成立するとは判断しない。
   package.jsonのmig:generate/migration:generateにはtypescript-migrationが残り、手動生成作業での利用可能性はある。
3. `sequelize-mig@3.1.3`は6系を使い、uuid等による集約指摘。srcとnpm scriptsにauto-migrations/migの利用は見つからないが、外部運用は未確認。
4. これらはdependenciesなので本番に残る。実際の生成運用を確認して不要なものを除去、必要な生成専用ツールはdevDependenciesへ分離する案。
   本番で必要な`sequelize-cli db:migrate`まで一律に移動しない。監査件数削減だけを目的としたdev移動では、開発時の脆弱性は解消しない。
5. `tsc-alias@1.8.16 → chokidar/globby/fast-glob/micromatch → braces@3.0.3`はHigh。
   [bracesは修正版なし](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)。buildスクリプトで利用し、srcからの実行は見つからない。
   最新tsc-alias 1.9.8にもchokidar 3系/globby 11系が残る。auditが提案する1.0.11はダウングレードなので自動適用しない。
   まずbuild専用として本番からの分離を検討し、ビルド時パターンの入力元を管理する。完全解消には上流修正・代替方法の検討が必要。
6. dev専用検出は9パッケージ（下表）。vitestとcoverage-v8は4.1.12以上を揃え、Viteは8.2.4以上、source-map-jsは1.2.2以上等へ解決する候補。
   公開dev server・手動mock登録・エディタ起動・Windows等の条件を区別する。本番APIの到達性とは別評価。
   nodemon/ts-node-devにもbraces系の未修正経路がある。現在のdevスクリプトはtsx watchなので、不要性を確認して削除候補にする。

## 修正作業を分ける順序と完了条件

1. Multerを修正し、未認証経路も含めmultipartの正常・異常・中断テストを実施する。
2. Express 4.22.3、morgan 1.12.1、ip-address 10.7.1、moment 2.31.0等の範囲内・同major更新を個別に実施。
   lockfileでqs 6.16.0、body-parser 1.20.6、proxy-addr 2.0.8等の解決を確認する。
3. EJS・生成ツール・ビルドツールの必要性を確認し、削除または依存区分を見直す。旧ORM経路を取り除く。
4. dev依存を修正し、uuid/bracesの未修正経路は上流対応や代替案・実際の到達性を根拠付きで記録する。
5. 各変更でserver lint・本番/テスト型検査・関連テスト・buildを実行。最終的に全依存とomit=devのauditを再取得し、
   本番Dockerビルドと完成イメージ内の依存・基本動作を確認する。DB migrationは実行しない。

`npm audit fix --force`、無差別なoverrides、sequelizeのmajor変更は採用しない。
修正版候補は公開状況と依存範囲まで確認済みで、インストール後の互換性や監査件数の減少は未検証。
今回は文書のみの変更なのでlint・型検査・テスト・Dockerビルドは再実行していない。

## 全検出パッケージ一覧

版はauditのnodesに対応するlockfileの値。severityはnpm集約値。本番欄の「有」はomit=devでも検出されたことを示す。
全GHSA・影響範囲・fixAvailable・nodesは原本JSON、全依存経路はdependency-paths.jsonを参照。

| パッケージ | 対象版 | severity | 本番検出 | 原因 / 主な経路 |
| --- | --- | --- | --- | --- |
| @vitest/coverage-v8 | 4.1.11 | moderate | 無 | vitest |
| @vitest/mocker | 4.1.11 | moderate | 無 | GHSA-qxg6-89mg-rqv8, GHSA-xp26-3454-mjgp |
| body-parser | 1.20.4 | low | 有 | GHSA-v422-hmwv-36x6 |
| brace-expansion | 1.1.13, 1.1.18, 2.0.3, 5.0.5 | high | 有 | GHSA-3jxr-9vmj-r5cp, GHSA-6j4f-fj2g-mc7p, GHSA-jxxr-4gwj-5jf2, GHSA-mh99-v99m-4gvg, GHSA-q2hr-2g5m-vwhr, GHSA-qhr7-859c-m2p7, GHSA-rgw5-rvv9-x895 |
| braces | 3.0.3 | high | 有 | GHSA-vfj7-8cjw-p6xm |
| chokidar | 3.6.0 | high | 有 | braces |
| ejs | 2.6.2 | critical | 有 | GHSA-ghr5-ch3p-vcr6, GHSA-phwq-j96m-2c2q |
| esbuild | 0.27.5 | low | 無 | GHSA-g7r4-m6w7-qqqr |
| fast-glob | 3.3.3 | high | 有 | micromatch |
| globby | 11.1.0 | high | 有 | fast-glob |
| ip-address | 10.2.0 | high | 有 | GHSA-22jq-vg5j-6vgg, GHSA-2vr4-cq9g-pvrc, GHSA-4xrf-jv44-h6hh, GHSA-h3mg-xc3c-68pw, GHSA-j6r3-76f7-8jcv, GHSA-mwp4-54f8-5fhr, GHSA-rpw4-54j3-4h4q |
| js-cookie | 3.0.5 | high | 有 | GHSA-qjx8-664m-686j |
| js-yaml | 4.3.1 | high | 無 | GHSA-2883-xcg3-v3hh |
| micromatch | 4.0.8 | high | 有 | braces |
| moment | 2.30.1 | moderate | 有 | GHSA-4p3w-j4w9-5jqw |
| morgan | 1.9.1 | moderate | 有 | GHSA-4vj7-5mj6-jm8m, GHSA-9f6g-j8ch-79g4, GHSA-jxfw-x594-9x9m, on-headers |
| multer | 2.1.1 | high | 有 | GHSA-3p4h-7m6x-2hcm, GHSA-535w-7cp7-47q4, GHSA-72gw-mp4g-v24j, GHSA-qvfw-j98x-7q72, GHSA-wc9g-mqfw-jrwm |
| mysql2 | 2.3.3 | critical | 有 | GHSA-3f6p-5ww8-9rcr, GHSA-49j4-86m8-q2jw, GHSA-4rch-2fh8-94vw, GHSA-fpw7-j2hg-69v5, GHSA-mqr2-w7wj-jjgr, GHSA-pmh2-wpjm-fj45, GHSA-rgwj-5xj2-c3m3 |
| nodemon | 3.1.14 | high | 無 | chokidar |
| on-headers | 1.0.2 | low | 有 | GHSA-76c9-3jph-rj3q |
| proxy-addr | 2.0.7 | critical | 有 | GHSA-jqcg-44mw-7w3h |
| qs | 6.14.2 | moderate | 有 | GHSA-4mjr-xmp4-gh2g, GHSA-q8mj-m7cp-5q26, GHSA-x5fp-wj9c-mxmx |
| sequelize | 4.44.4, 5.22.5, 6.37.8 | critical | 有 | GHSA-8c25-f3mj-v6h8, GHSA-f598-mfpv-gmfx, GHSA-v8fg-2rw7-q452, GHSA-vqfx-gj96-3w95, GHSA-wrh9-cjv3-2hpw, uuid, validator |
| sequelize-auto-migrations | 1.0.3 | critical | 有 | sequelize |
| sequelize-mig | 3.1.3 | moderate | 有 | sequelize |
| sequelize-typescript | 1.1.0 | critical | 有 | GHSA-7pvx-4585-hqww, sequelize |
| sequelize-typescript-migration | 0.0.1-beta.3 | critical | 有 | mysql2, sequelize, sequelize-typescript |
| source-map-js | 1.2.1 | high | 無 | GHSA-68fv-2mgg-jv7q |
| ts-node-dev | 2.0.0 | high | 無 | chokidar |
| tsc-alias | 1.8.16 | high | 有 | chokidar, globby |
| uuid | 3.4.0, 8.3.2 | moderate | 有 | GHSA-w5hq-g745-h8pq |
| validator | 10.11.0 | high | 有 | GHSA-9965-vmph-33xx, GHSA-qgmg-gppg-76g5, GHSA-vghf-hv5q-vc2g |
| vite | 8.2.2 | high | 無 | GHSA-587h-7wmj-h5pm, GHSA-698v-4r3x-3vcv, GHSA-9jrq-w75r-8gcw, GHSA-r825-w8mm-5pxw, GHSA-rq7h-c2jc-7f22, GHSA-vfpm-58rq-9qcg |
| vitest | 4.1.11 | moderate | 無 | @vitest/coverage-v8, @vitest/mocker |

lockfile SHA256: `d6073f2ff51b892c9b701a39617044f7bf5f206243da16803db1c1f099489d66`


## 2026-10-22 修正結果

全依存・本番依存ともaudit 0件。調査時の34件/25件を解消した。
[全依存の修正後原本](audit-fixed-full.json)、[本番依存の修正後原本](audit-fixed-production.json)。
原本のerrorなし、両auditおよびnpm ls --all --jsonは終了コード0。
検出0は取得時点のnpmアドバイザリとの照合結果であり、将来の問題や全攻撃経路の不存在を保証するものではない。

### 実装した内容

| 対象 | 修正内容 |
| --- | --- |
| HTTP処理 | Multer 2.4.0、Express 4.22.3、morgan 1.12.1へ更新 |
| Express子依存 | body-parser 1.20.8、qs 6.16.1、proxy-addr 2.0.8 |
| IP・日時・CLI子依存 | ip-address 10.7.4、moment 2.31.0、js-cookie 3.0.8 |
| テンプレート | EJSを3.1.10へ更新。ルートviews/error.ejsが存在するため削除せず互換APIを維持 |
| テスト・開発 | Vitest/coverage-v8 4.1.12、tsx 4.23.15、esbuild 0.28.2、Vite 8.3.5等へ更新 |
| Sequelize子依存 | Sequelizeに限定したoverridesでuuidを11.1.1へ。Sequelize本体は6.37.8を維持 |
| 不要依存 | sequelize-auto-migrations、sequelize-mig、sequelize-typescript-migration、nodemon、ts-node-devを削除 |
| ビルド | srcの独自path alias importがないことを確認しtsc-aliasを削除。buildはtscのみ。typescript/ts-nodeはdevへ移動 |
| 認証先行 | shopSignupの身分証PATCHを認証→既存レート制限→params→multipart→bodyの順へ修正 |

uuidはCommonJSのrequireエントリを持つ11系の修正版に限定した。旧ORM4/5・mysql2等は旧生成ツールとともに除去。
この依存構成にはbraces/chokidar/globby/fast-glob/micromatchの指摘経路が残らない。
API追加・新ライブラリ・DB定義変更・既存migration変更は行っていない。

### マイグレーション生成手順の変更

旧ライブラリによるモデル差分生成を廃止し、既存sequelize-cliの雛形生成へ統一した。
`mig:generate`は`migration:generate`と同じエイリアス。**生成には名前が必要で、自動モデル差分は生成しない。**

```bash
cd server
npm run migration:generate -- --name change-description
```

生成した雛形はリポジトリ規約に従ってESMのup/downへ整え、内容をレビューしてから使用する。
今回、生成コマンドの実行・migration適用・undoは行っていない（確認は--helpのみ）。
`config/cli-options.json`で従来と同じconfig/config.cjsとmigrationsを指定し、4つのnpm migrationコマンドで明示読込みする。
これはNode.js 26で旧.sequelizercを自動読込みするとrequireが未定義になるため、置換後のnpmコマンドを起動可能にする対応。
直接のnpx呼出し等の旧.sequelizerc経路、実DB接続先とESM migrationの履歴管理の検証は
[既存CLI互換性Todo](../../todo/done/sequelize-cli-node26-esm-compatibility.md)に残す。
DB変更を伴う確認は今回の修正範囲には含めていない。

### 検証結果

Node.js 26.12.1 / npm 11.20.0 / Vitest 4.1.12。

- npm run lint、npm run typecheck、tsc --noEmit -p test/tsconfig.json、npm run buildが成功。
- 最終結合実行: 70ファイル、1965件中1963件成功・2件失敗・skip 0。
  対象は全src単体、multipart/security、security/dependencyCompatibility、ErrorHandler、auth/refreshToken/jwt.test.ts。
- 失敗2件はsrc/services/itemDraft/test/deleteItemDraft.test.tsの既知item_id取得カラム不一致。
  依存更新前の調査と同一の差分で、対象本番コード・fixture・期待値は変更していない。
  [既存Todo](../../todo/done/align-delete-item-draft-service-test-columns.md)で別管理する。
- 今回追加: multipart 2ファイル10件、Sequelize/uuid 1ファイル5件が全件成功（上記集計内）。
  既存ErrorHandler/JWTの34件も全件成功（同じ集計内）。
- 実Routerで認証拒否401・制限拒否429が解析に先行し、両通過時は同一不正multipartが400になることを確認。
  認証・Redis・controllerの先は境界モック。実JWT/Redisの内部動作やDB/AWSはこのRouter試験で保証しない。
- 上流修正と同じ巨大配列index＋push入力でINVALID_FIELD_NAMEと後続正常処理を確認。
  深さ・indexの新上限は追加していない。深いフィールドの負荷・実TCP途中切断・長時間メモリ回収は未検証。
- Sequelize実ModelのUUIDv1/v4既定値生成とvalidation、PostgreSQL transaction ID生成、
  ORM配下uuidのv3/v5における出力buffer境界超過のRangeErrorを確認。DB接続・SQL・実transactionは未実施。
- 最終本番Dockerイメージproject-server-security-checkのnpm ci（builder/本番依存）・buildが成功し、両段でaudit 0件。
  初回のDocker credential helper一時エラーは再実行で解消した。
- 完成イメージ内でSequelize/uuid・bcrypt/JWT・EJSエスケープ・IPv4/IPv6キー生成が成功。
  同イメージでmigration:generate -- --helpも成功。ホストではgenerate/run/revertの--helpが成功。
  外部ネットワーク・DB接続・migration適用・本番デプロイは行っていない。
- テスト詳細: [multipart](../../../server/test/docs/report/multipart/security.md)、
  [Sequelize互換性](../../../server/test/docs/report/security/dependencyCompatibility.md)。カバレッジは未取得。

最終集計の一時原本は/tmp/server-security-final-results.json。上記件数・対象・残る失敗を本書に保存した。
本番反映には更新イメージのビルド・デプロイが必要。

修正後lockfile SHA256: `c1d086e7bc6899175cd3490162d23d12dbf147d8250fddfa0580c03bcb97e9b0`
