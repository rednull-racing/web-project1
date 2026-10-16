# Codexログ

## 20261014*documents*バックエンドコーディング規約の参照パス修正

### 作業内容

- docs・server配下の14ドキュメントで参照パスを `docs/codingRule/backend` に統一。

### 変更目的

- コーディング規約ディレクトリの移動に合わせて参照先を更新。

### 注意点・その他留意事項

- docs/AGENTS.mdを確認し記録。パス修正とログ記録のみ実施。

---

### 20261014_backend-coding_createItemEditingCopy規約衝突による実装中断

- 詳細設計書とController規約、および関連AGENTS.mdを確認。
- 詳細設計の成功レスポンス `201 Created` とController規約の `200` または `202` に衝突を確認。
- ユーザーの指示に従い、本番コードを変更せず実装を中断。
- テストは作成・実行していません。実装完了および設計との最終照合は未実施。

---

### 20261014_documents_Controller成功レスポンス規約更新

- Controller規約で成功レスポンスに `200`、`201`、`202` を許可するよう変更。
- createItemEditingCopy詳細設計の `201 Created` と規約の衝突を解消。
- ドキュメントのみ変更。`git diff --check` で差分を確認。

---

### 20261014_backend-coding_createItemEditingCopy実装

- 規約・AGENTS.mdを再確認し、POST /item-editing/copyのRoute・Controller・Validator・RateLimit・UseCase・Service・型を実装。
- 認証後にユーザー単位で10分5回を制限し、所有する販売中商品を行ロック後に同一トランザクションでコピー。成功時は201とitemEditingIdを返却。
- 在庫currentをinitialへ戻し、sale.before_priceをprice・before_priceへコピー。割引を解除し、コピー元と既存編集セッションを保持。
- 設計の処理フロー・コピー項目と照合済み。認可は第3章に準拠し、第2章のItemDraft表記の不一致はTodoへ記録。
- lint・typecheck・git diff --check通過。指定どおりテストは作成・実行せず、マイグレーションも実行していません。
- 範囲外の既存新規作成ServiceのModel誤りとModel再exportの型消失は修正せずTodoに記録。

---

### 20261014_documents_createItemEditingCopy認可対象修正

- 詳細設計の認可対象をコピー元のItem所有者に修正し、ItemDraftを使用しないことを明記。
- コピー処理のRoute・Controller・UseCase・Serviceを確認し、ItemDraftの取得・所有者確認を行っていないことを確認。
- Item.findOneのid・seller_id条件で所有者確認済みのため、本番コードの修正は不要。
- 認可対象表記のTodoをdoneへ移動。git diff --check通過。テストは未実施。

---

### 20261014_backend-coding_createItemEditing保存先Model修正

- createItemEditingの保存先をItemからItemEditingへ変更し、不要なItem importを削除。
- 作成結果を返すServiceは規約に合わせてPromiseを直接returnし、型専用importを明示。
- UseCase・Controllerが作成した編集セッションのidをitemEditingIdとして返すことを確認。
- lint・typecheck・関連Serviceテスト21件・git diff --check通過。
- Todoをdoneへ移動。コピー・下書き処理、Model・DBスキーマは変更せず、マイグレーションも未実行。

---

### 20261014_backend-coding_no-explicit-any無効化設定削除

- server/eslint.config.mjsのno-explicit-any: offを削除し、推奨設定によるanyのエラー検知を復元。
- 指示どおり既存コードのエラー解消は行わず、Todoは未完了のまま維持。
- lintは既存のexplicit anyを41件検出して失敗。typecheckは通過。

---

### 20261014_backend-model_Modelレジストリ型復元

- models/index.tsの2箇所のanyを削除し、ModelRegistryと具体的なModel型を再export先まで保持。
- associateはModelのみを走査し、既存定義に合わせて引数なしで呼び出す。
- OrderDeletedの再exportは登録名OrderDeletedSystemsを参照するよう整合。
- lintは残存any39件、typecheckは型復元で表面化した87ファイル288件のエラーで失敗。index.ts自体に型エラーなし。
- Service・UseCaseの修正は行わず、残作業を既存Todoに追記。DB・マイグレーション変更なし。

---

### 20261014_backend-coding_UseCaseのnullable数値変換

- UseCaseの10ファイルでnullableな数値をNumber()で変換し、算術演算・Service引数の型エラー19件を解消。
- 単純なstring | nullの型エラーは現状なし。オブジェクト・配列・日付のnullや関連Model型のエラーは対象外。
- 変更ファイルのlint通過。全体lintは既存any39件、typecheckは対象外217件のエラーで失敗。
- Number(null)は0となる。既存のユーザー変更は保持し、Service・Model・DBは変更していない。

---

### 20261014*backend-model*関連Model参照型定義

- 16個のModelで関連プロパティ41件をNonAttributeで宣言し、単数・複数と未取得・nullの可能性を型へ反映。
- getMyItemWithVideoSaleShippingはtransactionなしの取得結果も具体的な関連型で返す契約へ修正。
- Sequelizeの実際の関連名・対象・件数と宣言の一致、および16ファイルの変換後JavaScriptが変更前と同一であることを確認。
- 変更ファイルのlint通過。全体lintは既存any39件、typecheckは217件から107件に減少したが対象外エラーで失敗。
- null確認・関連名不一致・存在しないカラム等は未修正。既存Todoを更新し、関連名不一致をP1 Todoへ記録。
- DBスキーマ・関連定義・業務処理は変更せず、マイグレーションも不要・未実行。

---

### 20261014_backend-coding_Service検索条件のwhere型付け

- serviceTypeのwhere: anyを4箇所修正し、Item・Ordersのインスタンス属性に対応するWhereOptionsを指定。
- ServiceのfindAll・countへの受け渡しとUseCaseの検索条件を照合し、呼び出し元14箇所のwhere: anyも同じ型へ変更。
- SearchItemParamsのInferAttributesへModelクラスを渡す誤りも同じ商品検索型へ統一して解消。
- 16ファイルの変換後JavaScriptが変更前と同一であることを確認。変更ファイルlint・git diff --check通過。
- 全体lintは既存any21件、typecheckは対象外98件で失敗（変更前99件）。別名itemWhereのanyは今回の対象外。
- 商品一覧のstatusとModel定義の不一致は修正せずP2 Todoに記録。DB・クエリ・業務処理は未変更。

---

## 20261014_backend-coding_Itemの旧status参照削除

- Itemのactive・soldout以外の条件・代入を削除し、フロントエンドのItem型と旧画面のstatus判定も整合。
- 最終指示に従い下書き・削除済み一覧、旧削除API、定期処理、取得対象Modelを維持。通常商品が混ざることは了承済み。
- 所有者条件・検索語・ページング・期限・transactionを維持する動作確認を実施。DBへのクエリ発行なし。
- 旧1週間削除はcreatedAtの期限のみで通常商品も対象。30日削除はdeleted_atの期限を保持。
- 変更ファイルlint・client typecheck・git diff --check通過。全体lintはserver21件・client29件、server typecheckは97件の対象外エラーで失敗。
- Todoをdoneへ移動。DB・Model定義・マイグレーションは変更していない。

---

## 20261014_backend-coding_itemWhereのany解消

- カート・いいね・閲覧履歴のserviceTypeと呼び出し元UseCaseの計6箇所でitemWhereのanyを既存ItemWhere型へ変更。
- Serviceのinclude先がItemであることを確認。検索条件・所有者条件・ページングは変更していない。
- 6ファイルの変換後JavaScriptが変更前と同一であることを確認。変更ファイルlint・git diff --check通過。
- 全体lintは残存any15件、typecheckは対象外97件のエラーで失敗。変更した6ファイルに型エラーなし。

---

## 20261014_backend-coding_SaleからItem取得の参照方向修正

- saleEdit.ts・saleStop.tsで廃止済みSale.item_idを使わず、Item.sale_idとseller_idから対象Itemを取得。
- getMyItemBySaleIdのService・引数型・再exportを追加。必要なItem.idのみ取得し、所有者確認を検索条件へ維持。
- セール開始・終了の価格・フラグ更新、共通transaction、Sale不在・商品不在／他所有者時の更新停止、既存入力検証をDB接続なしで確認。
- 変更ファイルlint・git diff --check通過。全体lintは残存any15件、typecheckは対象外92件で失敗。今回のSale参照エラーは解消。
- saleShop.tsは存在しないためsaleStop.tsを修正。旧createSaleのitem_id指定は変更せずTodoへ記録。
- DB・Model・マイグレーションは変更していない。

---

## 20261014*backend-coding*検索履歴ソートのany解消

- getSearchHistory.tsのsort引数のanyを削除し、Serviceが返すSearch型の推論を使用。
- createdAtはDateのためgetTime()で数値へ変換し、新しい日時順の並び替えを維持。
- 対象ファイルlint・git diff --check通過。全体lintは残存any13件、typecheckは対象外92件で失敗。対象ファイルの型エラーなし。

---

## 20261014*backend-coding*日時比較の型エラー確認

- serverのtypecheckと日時比較・sortの参照を確認。Dateを直接減算することに起因する型エラーは現状なし。
- createdAtの比較4箇所とトークン期限比較は既にgetTime()を使用しているため、コード変更なし。
- typecheckは対象外92件のエラーで失敗。getSearchItemsのuploaded_atはgetTime()未使用ではなくnullableが原因のため未修正。

---

## 20261014_backend-model_PermitのS3Metadata関連型修正

- Permit.S3MetadataをNonAttributeで宣言し、belongsToのasをS3Metadataへ明示して自動生成名S3Metadatumとの不一致を解消。
- 関連取得Serviceのincludeを同じasへ統一し、3種類のgetFileは型推論で関連参照・null除外を行うよう修正。
- Sequelizeメタデータとbuildで関連取得結果・nullを確認。DB・S3へのアクセスなし。
- 変更ファイルlint・git diff --check通過。全体lintは対象外12件、typecheckは対象外89件で失敗。getFileの該当型エラーは解消。
- DBカラム・外部キーは変更せず、マイグレーション不要。Permits／Permitの別問題は未修正として既存Todoを更新。

---

## 20261014_backend-model_ShopInfoEditのPermit関連型修正

- ShopInfoEdit.PermitをNonAttribute<Permit[]>で宣言し、hasManyのasをPermitへ明示。
- ShopInfoEdit取得ServiceのincludeをPermitへ統一し、updateIdImage.tsの関連参照型エラーを解消。
- Sequelizeのbuildと削除処理のモックで、複数Permit・単数S3Metadata・空配列・transactionを確認。DB・S3へのアクセスなし。
- 変更ファイルlint・git diff --check通過。全体lintは対象外12件、typecheckは対象外85件で失敗。updateIdImage.tsの型エラーなし。
- 外部キー・DBカラムは変更せずマイグレーション不要。ShopInfo・ShopSignupの別の不一致は既存Todoに残す。

---

## 20261014_backend-model_ShopSignupのPermit関連型修正

- ShopSignup.PermitをNonAttribute<Permit[]>で宣言し、hasManyと取得ServiceのincludeのasをPermitへ統一。
- oldShopSignup.tsは複数Permitと各単数S3Metadataを処理するよう修正し、空配列・関連不在も許容。
- Sequelizeのbuildと削除処理のモックで、複数Permit・単数S3Metadata・空配列・transactionを確認。DB・S3へのアクセスなし。
- 変更ファイルlint・git diff --check通過。全体lint・typecheckは対象外の既存エラーで失敗。oldShopSignup.tsの型エラーなし。
- 外部キー・DBカラムは変更せずマイグレーション不要。既存Todoの進捗を更新。

---

## 20261014_backend-coding_VideoからItem取得の参照方向修正

- onPlay.tsの廃止済みvideo.item_id参照を、Item.video_idで取得するgetItemByVideoIdへ変更。
- Serviceと再exportを追加し、更新に必要なid・status・sort_number・sort_buzz_numberのみ取得。
- 再生回数・ランキング更新、未認証／soldout時の条件、Video・Item不在時のエラーをDB接続なしで確認。
- 変更ファイルlint・git diff --check通過。全体lintは対象外10件、typecheckは対象外66件で失敗。onPlayの型エラーなし。
- 旧Video Serviceの削除済みカラム参照は変更せずTodoへ記録。Model・DB・マイグレーションは未変更。

---

## 20261014_backend-coding_videoConvertのany解消

- S3のBodyをReadableのinstanceof判定で絞り込み、as anyを削除。不正なBodyは既存のS3_OBJECT_BODY_INVALIDで通知。
- Promiseとpipeの接続をNode標準pipelineへ変更し、動画全体をメモリに読み込まず転送。送受信ストリームのエラーも伝播。
- S3送信をモックし、バイナリ保存・Body不在／不正・読み込み／書き込み失敗・アップロードを確認。
- 対象ファイルlint・git diff --check通過。全体lintは対象外10件、typecheckは対象外66件で失敗。対象ファイルの型エラーなし。

---

## 20261014*backend-coding*未使用toNullableNumber削除

- リポジトリ内の参照を確認し、toNullableNumberはコードからの呼び出し・import・再exportがないことを確認。
- 指示に従いserver/src/utils/toNullableNumber.tsを削除。既存テスト設計書の名前記載のみ残存。
- lint・typecheckを実行。削除したファイルを参照する型エラーなし。全体には対象外の既存エラーが残存。
- git diff --check通過。他の変換処理や呼び出し元は変更していない。

---

## 20261014_backend-coding_maintenanceのlint型チェック除外

- server/eslint.config.mjsのignoresとserver/tsconfig.jsonのexcludeへsrc/maintenance/\*\*を追加。
- ESLintの除外判定とTypeScriptの実際の対象ファイルを確認し、maintenanceのみが外れprototype・usecasesが対象に残ることを検証。
- lint・typecheckを実行し、maintenance配下の指摘がなくなったことを確認。ほかの既存エラーは残存。
- git diff --check通過。ソースコード・DB・依存ライブラリは変更していない。

---

## 20261014*backend-model*銀行支店normalize型定義

- 銀行・支店の取得データと既存テストを確認し、BankNormalization共有型を追加。名称のみのJSONにも対応。
- Banks・Branchesのnormalizeをobject | nullから具体的な型へ変更し、口座編集・銀行／支店検索などのname・kana・hira参照エラーを解消。
- DB接続なしで正規化名称検索・null／名称のみのJSON・元名称へのフォールバック・既存所有者条件を確認。
- 変更ファイルlint・git diff --check通過。全体lintは既存3件、typecheckは対象外32件で失敗。
- 関連signup2テストは既存Model初期化エラーで0件実行のためTodoへ記録。DB・Model制約・検索処理は変更していない。

---

## 20261014_backend-coding_prototypeのlint型チェック除外

- ESLintのignoresとtsconfigのexcludeへsrc/prototype/\*\*を追加し、既存maintenance除外も維持。
- 実際のTypeScript対象とESLint除外を確認。prototype・maintenanceのみ外れ、usecasesは対象に残ることを検証。
- lint・typecheckを実行。除外したディレクトリの指摘なし。ほかの既存エラーは残存。
- git diff --check通過。ソースコード・DB・依存ライブラリは変更していない。

---

## 20261014*backend-coding*銀行支店取得スクリプトのany解消

- fetchBanksAndBranches.tsのany配列をZodから推論するDirectoryEntry配列へ変更し、transaction型も明示。
- 取得JSONはunknownで受け、既存BankNormalizationに対応する構造を検証。不正な要素はAppErrorで既存rollback処理へ渡す。
- 検証ヘルパーだけを評価し、通常／名称のみ／null／空配列／不正データを確認。スクリプト・DB更新・外部API呼び出しは実行していない。
- server全体lint・git diff --check通過。typecheckは対象外28件の既存エラーで失敗。対象スクリプトの型エラーなし。
- ページング・保存カラム・commit／rollbackの流れを維持。ライブラリ追加なし。
## 20261015_backend-coding_services型エラー修正

- services配下12ファイルの型エラー17件を解消。削除12箇所のtransactionをoptionsに統合。
- findAllの未対応distinctとfindOneの無効なrequireを削除し、店舗編集S3取得をShopInfoEditへ修正。
- モックで削除条件・transactionの有無・DBエラー伝播・期限削除の戻り値・店舗編集の取得先と所有者条件を確認。
- 全体lint・git diff --check通過。typecheckはservices内0件、対象外13件で失敗。
- services外のソースは変更せず、店舗申請取得のnullable推論で表面化した呼び出し側2件を既存Todoに記録。

---

## 20261015_backend-coding_ユーザー削除返金口座のnullable型修正

- deleteUser.tsの返金口座引数エラーを、deleteUserRefund.tsの入力型修正で解消。
- BankAccountの対象カラムをPickで参照し、口座自体のnullも許容。既存の空文字への変換処理は維持。
- 全体lint・返金ヘルパー既存テスト3件が通過。typecheckは対象エラー解消、対象外2件が残存。

## 20261015_backend-coding_関連取得プロパティ名の残存不一致修正

- ShopInfoの関連定義・型・includeを既存参照のPermitへ統一。
- prototypeの注文取得のカテゴリinclude・参照とItemのassociations型をCategoryへ統一。
- server全体lint・typecheck、git diff --check通過。DB接続なしで関連名・include・関連ファイル有無・所有者条件を検証。
- 元Todoを完了に更新。別件のShopInfo→Permit外部キー不整合はP1 Todoへ記録し、変更していない。
- DBスキーマ変更・migration実行なし。

## 20261015_backend-model_ShopInfo許可証関連の外部キー修正

- Permitモデルのカラム定義に合わせ、ShopInfo→PermitのforeignKeyをpermit_idからshop_info_idへ修正。
- 関連名Permit・hasMany・カラム制約を維持。既存migrationと整合しており、新規migrationは不要。
- server全体lint・typecheck通過。DB接続なしで双方向の外部キー・生成JOIN・所有者条件・関連ファイル有無を確認。
- 対象Todoを完了に更新。DBクエリ・migration実行なし。

## 20261015_backend-coding_旧商品作成のSale関連保存修正

- createSaleに残っていたSale.item_idへの保存を削除し、Sale作成結果を返すよう変更。
- UseCaseでSaleを先に作成し、同じtransactionの商品作成へsaleIdを渡してItem.sale_idに保存。
- server全体lint・typecheck通過。DBモックで関連ID・所有者・transaction・戻り値・全作成段階のエラー伝播を確認。
- 対象Todoを完了記録付きでdoneへ移動。Model変更・DB接続・migration実行なし。

## 20261015_backend-coding_旧Videoサービスのカラム参照修正

- createVideoのitem_id・user_id保存を廃止し、商品作成時に作成済みVideo.idをItem.video_idへ保存。
- getMyVideoはItemへの必須JOINとseller_id条件で所有者を確認。Sale関連・transaction・戻り値を維持。
- server全体lint・typecheck通過。DBモックで作成関連・全作成段階のエラー伝播、生成SQLで所有者条件・旧カラム不使用を確認。
- 対象Todoを完了記録付きでdoneへ移動。Model変更・DB接続・migration実行なし。

## 20261015_backend-test_signup2テストのModel初期化エラー修正

- signup2.test.tsのShopSignupモック先を現行query.js・command.jsへ変更。既存形式・5ケース・期待値を維持。
- 修正前のDeliveryStatusOption.initエラーを再現し、修正後の対象5件成功を確認。本番コード・DB設定は変更なし。
- server全体lint・本番typecheck・対象テスト追加lintが通過。テスト型検査は対象外signup1・signup5の旧importエラー2件で失敗し、別Todoへ記録。
- 対象Todoへ完了内容を記録。DB接続・migration実行なし。

## 20261015_backend-test_signup1とsignup5のimport先修正

- ユーザー指定に従い、UseCase・helperのimport先とShopSignup依存モック先だけを現行パスへ修正。
- テスト形式・既存ケース・期待値を維持。本番コード・DB設定は変更なし。
- signup1・signup2・signup5の17件成功。全体lint・本番typecheck・テスト型検査通過。
- 対象テストへのtypescript-eslint推奨設定による追加lintはsignup1の既存未使用変数4件で失敗し、別Todoへ記録。
- 対象Todoを完了に更新。DB接続・migration実行なし。

## 20261015_backend-test_signup1テストの未使用変数解消

- 任意項目省略ケースの入力をSignup1Body型で宣言し、対象4プロパティをdeleteして未使用変数を解消。
- 既存の入力条件・期待値・テスト形式を維持。本番コード・共通lint設定の変更なし。
- 対象8件成功。全体lint・対象テスト追加lint・本番とテストの型検査・git diff --checkが通過。
- 対象Todoに完了内容を記録。DB接続・migration実行なし。

## 20261016_documents_作業ブランチ運用ルールのレビュー

### 作業内容
- ルートAGENTS.mdのブランチ作成・統合・worktree運用をレビュー。
### 変更目的
- 統合コマンドの欠落、未コミット変更の扱い、並列作業の終了手順を確認。
### 注意点・その他留意事項
- AGENTS.mdの修正・ブランチ切替は行わず、レビュー結果を回答。ログのみ追記。

## 20261016_backend-test_createItemEditingCopy単体テストの配置変更

- refactor/create-item-editing-copy-testsで作業。設計書をtest/docs/architecture/createItemEditingCopy.mdへ移動し、参照リンクと配置・実行案内を更新。
- 単体テストをsrcの対象ディレクトリ内のtestへ移動し、取得・作成serviceを分割。import・モック先とExpress型を実装の配置・型に合わせた。
- 共通fixtureをusecaseのtestへ移動し、旧配置に結合テスト用の再exportを維持。Router・DB結合テスト本体は変更・実行なし。
- 単体6ファイル173件成功。serverのlint・typecheck通過。
- test/tsconfig.jsonの型検査は保留中の結合テストに既存8エラー。旧参照先・型エラーをP3-techdebtのTodoへ記録。DB接続・migration実行なし。

## 20261016_backend-architecture_itemEditingControllerの配置変更

- refactor/item-editing-controller-directoryでcontrollerをcontrollers/itemEditing/itemEditing.tsへ、既存testをcontrollers/itemEditing/testへ移動。
- controller内部・Route・関連controllerテストのimportと、関連設計書の参照パスを更新。処理・期待値は変更なし。
- serverのlint・typecheck・git diff --check通過。移動したcontrollerテスト5件成功。
- 既存Draft・updateConfirmのcontrollerテストはDB依存の初期化時にDATABASE_URL未設定で停止。対象外のモック不足としてTodoへ記録。
- DB接続・migration実行なし。

## 20261016_backend-architecture_controller直下ファイルのディレクトリ分割

- refactor/controller-directoriesでcontrollers直下の36個のTSファイルを、拡張子を除いた同名フォルダへ移動。
- 各フォルダにtest/.gitkeepを追加し、空のテスト用ディレクトリをGitで保持。
- controller内の相対パス、Route・関連テスト・設計書・規約例の参照を更新。36ファイルの処理本体が変更されていないことを確認。
- serverのlint・typecheck、関連controller・Routerテスト3ファイル29件、git diff --check通過。
- HTTPテストはサンドボックスのlisten制限で初回停止し、許可後の再実行で全件成功。DB接続・migration実行なし。

## 20261016_backend-test_createItemEditingCopy結合テストの分類移動

- refactor/create-item-editing-copy-integration-layoutで結合テスト5ファイルをルートtest/integration/backendへ移動。
- database/createItemEditingCopyへ永続化・制約テスト、usecases/createItemEditingCopyへtransaction・並行処理・HTTP接続テストを分類。
- backend/services・integration/cross-layer・test/fixturesを作成し.gitkeepで保持。fixture・setup計4ファイルは旧配置のまま内容も維持。
- 移動したテストの相対importとrouteの旧usecaseモック先を更新。全参照先の存在と、パス以外のテスト内容が不変であることを確認。
- serverのlint・typecheck・git diff --check通過（ルートの結合テストは検査対象外）。結合テスト・DB接続・migrationは未実行。
- ルート配置に対応する実行・型検査環境を別Todoに記録し、設計書・既存Todoの配置情報を更新。

## 20261016_backend-test_itemEditingテストの階層追加

- refactor/item-editing-test-pathsで結合テストのdatabase・usecases配下にitemEditing階層を追加。
- テスト設計書をtest/docs/architecture/itemEditing/createItemEditingCopy.mdへ移動。
- 移動したテストの相対import、設計書のリンク、関連Todoの参照パスを更新。
- 相対import先・Markdownリンク先の存在とgit diff --checkを確認。配置・参照修正のみのためテスト実行・DB接続なし。

## 20261016_backend-test_createItemEditingCopyのfixture移動

- refactor/create-item-editing-copy-fixturesでfixture・DB setup計4ファイルをtest/fixtures/backend/itemEditing/createItemEditingCopyへ移動。
- 結合テスト・fixture内の相対importとDB fixtureの旧usecase参照を更新。設計書・関連Todoも現配置へ更新。
- 全9ファイルの相対参照先の存在と、fixtureのパス以外の処理が不変であることを確認。
- serverのlint・typecheck・git diff --check通過。ルートtestの実行環境は既存Todoで管理中のため結合テストは未実行。
- DB接続・migration実行なし。

## 20261016_backend-test_server配下へのテスト集約

- refactor/server-test-layoutでルートtestのintegration・fixtures・docsをserver/testへ移動。
- integrationのbackend階層を除きdatabase・services・usecasesを直下に配置。空のcross-layerとルートtestを整理。
- テスト・fixtureの相対import、設計書リンク・実行案内を更新。本番コード・依存・設定は変更なし。
- serverのlint・typecheck、全テストの型検査、HTTP結合テスト22件、git diff --check通過。
- 既存の参照先・型エラーが解消し、ルート実行環境と型修正のTodo2件をdoneへ移動。
- 実DBテスト・DB接続・migrationは未実行。

## 20261016_documents_createItemEditingDraftテスト文書の移動・統合

- 設計書をserver/test/docs/architecture/itemEditing/createItemEditingDraft.mdへ移動。
- 初回報告とafterFix.mdの全内容をserver/test/docs/report/itemEditing/createItemEditingDraft.mdへ統合し、旧3ファイルを削除。
- 移動後の相対リンクと初回・修正後の記録の区別を整理。Daft表記はDraftに統一。
- 内容保持・リンク先・git diff --checkを確認。文書のみの変更のためテスト・DB接続は未実行。

## 20261016_backend-test_createItemEditingDraft単体テストの配置変更

- usecase・controller・validator単体テストを対応するsrc配下のtestへ移動し、serviceテストをitemDraft／itemEditingへ分割配置。
- 共通fixtureをsrc/usecases/itemEditing/testへ移動し、単体・既存結合テストのimportとmockパス、設計書の配置・実行案内を更新。
- controllerに他usecaseのDB読込みを防ぐモックを追加し、controller・validatorのExpress型importを既存単体テストと統一。
- 単体テスト5ファイル103件、serverのlint・typecheck、test/tsconfigの型検査、相対参照85件とgit diff --checkを確認。
- Router・DB結合テストは現配置を維持。結合テスト実行・DB接続・migrationは未実施。

## 20261016_backend-test_createItemEditingDraft統合テストの配置変更

- database.test.tsをtest/integration/database/itemEditing/createItemEditingDraftへ移動。
- transaction・並行処理・Routerの3テストをtest/integration/usecases/itemEditing/createItemEditingDraftへ移動。
- import・mockの相対パスと設計書の配置・実行案内を更新。DB fixture・setupは旧配置を維持。
- lint・typecheck・テスト全体の型検査、全4テストの参照先とパス以外の内容保持、git diff --checkを確認。
- Router40件は対象外Copy usecaseの既存モック漏れでDB設定読込み時に停止。範囲外修正はせずTodoへ記録。
- 実DBテスト・DB接続・migrationは未実施。

## 20261016_backend-test_itemEditingのfixture配置統一

- test/fixtures/backend/itemEditing/createItemEditingCopyの4ファイルをtest/fixtures/itemEditing/createItemEditingCopyへ移動。
- DraftのdatabaseFixtures.ts・databaseSetup.tsをtest/fixtures/itemEditing/createItemEditingDraftへ移動。
- 依存元・移動先のimportとmockパス、設計書・関連Todoの参照パスを更新。空になった旧ディレクトリを削除。
- 変更TS14ファイルのパス以外の内容保持・相対参照先、lint・typecheck・テスト全体型検査・git diff --checkを確認。
- CopyのHTTP統合テスト22件成功。初回はサンドボックスのlisten制限で停止し、許可後に再実行。
- DB接続・実DBテスト・migrationは未実施。Draftの既存Routerテスト問題は既存Todoで継続管理。

## 20261016_documents_テスト関連ディレクトリ構成の明文化

- server/test/AGENTS.mdに単体テスト・結合テスト・fixture/setup・設計書・レポートの配置規則と例を記載。
- 単体テストは本番コードに最も近いtest、結合テストは役割/大分類/小分類、fixtureは大分類/小分類に統一。
- 設計書・レポートはarchitectureまたはreportの大分類/小分類.mdへ配置。設計・実施・コード・モックの手順は記載なし。
- 記載内容と既存パス例、git diff --checkを確認。文書のみのためテスト実行なし。

## 20261016_backend-test_updateConfirmテストの5分類移動

- 単体6ファイルを本番コード付近、結合5ファイルをintegration、fixture3ファイルをtest/fixtures/itemEditing/updateConfirmへ分類移動。
- 設計書をdocs/architecture/itemEditing/updateConfirm.mdへ移動し、testReport・afterFixの全内容をdocs/report/itemEditing/updateConfirm.mdへ統合。
- import・mock・文書参照を更新。fixtureの配置に合わせ、本番tsconfigからテストを除外しテスト用tsconfigで全テストを型検査。
- lint・本番/テスト全体型検査・内容保持・参照先・git diff --checkを確認。移動前後の比較はともに451成功/57失敗、controller収集失敗で成否一致。
- 数値変換・動画署名の旧期待値とRouter/controllerの既存モック漏れはTodoへ記録。実DBテスト・DB接続・migrationは未実施。

## 20261016_backend-test_createItemDraftテストの5分類移動

- 単体8ファイルを本番コード付近へ、結合5ファイルをintegration/{database,usecases}/itemDraft/createItemDraftへ移動。
- fixture3ファイルをtest/fixtures/itemDraft/createItemDraftへ移動し、import・mockパスを更新。serviceテストは対象に応じ3分割。
- 設計書をdocs/architecture/itemDraft/createItemDraft.mdへ移動。testReport・afterFixの全内容をdocs/report/itemDraft/createItemDraft.mdへ統合。
- DB非接続の単体・結合10ファイル823件、lint・本番/テスト全体型検査、内容保持・参照先・git diff --checkを確認。
- Router19件は初回のHTTP待受け制限後、許可を得て再実行し成功。実DBテスト177件・DB接続・migrationは未実施。

## 20261016_backend-test_旧usecaseテストディレクトリの削除

- ユーザー指定に従いserver/test/usecases配下の全ディレクトリと旧テスト・補助コード9ファイルを削除。
- server/test/usecases/AGENTS.mdのみ残し、内容が変更されていないことを確認。
- serverのlint・typecheck・テスト全体型検査とgit diff --checkが成功。テスト実行・DB接続なし。

## 20261016_documents_テスト共通ルールの責務別分割

- integration/database・integration/usecases・fixtures・docs/architecture・docs/reportにAGENTS.mdを作成し、旧usecasesの共通ルールを分割。
- src/AGENTS.mdに単体共通・utilityルールを追記し、controllers・services・usecases・validatorsの既存AGENTS.mdに各層の単体ルールを追記。
- DBの全接続ガード・中断条件・後片付け、設計と期待値、モック・非同期、報告と修正履歴の規則を現配置へ移管。
- 文書参照を更新後、server/test/usecasesとserver/test/utils（旧utilityテスト2件）を削除。
- src既存ルールの保持・単体テストの適用先・文書リンク54件・lint・本番/テスト全体型検査・git diff --checkを確認。
- 共通ルール整理と指定削除のため、テスト実行・DB接続・migrationは未実施。

## 20261016_backend-architecture_service直下TSのフォルダ化

- services直下の54ファイルを同名フォルダ/同名.tsへ移動し、各フォルダにtestを配置。空のtestは.gitkeepで保持。
- 共通services/testを解消し、createItemDraftのマスター・別名テストを7フォルダへ分割、updateConfirm別名テストをbrandAliases/testへ移動。
- 呼出し元・モックを含む181ファイルの参照を更新し、service規則・設計書・レポート等の参照と実行案内を現配置へ更新。
- service単体は移動前9/移動後15ファイルとも72件成功、全テスト名・成否一致。関連usecase6ファイル563件も成功。
- lint・本番/テスト全体型検査、変更結合TS5ファイルの追加lint、パス以外の内容保持・参照先・git diff --checkを確認。
- DB接続・実DBテスト・migrationは未実施。

## 20261016_backend-test_createItemEditingDraftのRouterをDB設定から分離

- 対象外createItemEditingCopyのモック漏れによる40件の初期化失敗を再現し、実import先へのモック追加で解消。
- NODE_ENV=test・.env.testのDATABASE_URLの存在を確認。db.tsの読込み前検査と上書き後検査不足は別Todoへ記録。
- Router40件はHTTP待受けの制限解除後に全件成功。lint・本番/テスト全体型検査・対象TS追加lintも成功。
- 設計書・レポートを更新し、対象Todoをdoneへ移動。本番コード・環境設定の変更、DB接続・migration実行なし。
