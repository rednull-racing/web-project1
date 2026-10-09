# 商品編集中データの確定更新：修正案と修正後のテスト設計

## 1. 本書の対象

[testReport.md](./testReport.md) の観測結果を根拠として、`server/src` 内の修正案と、修正後に必要なテストの方針をまとめる。テストの責務分離・モック方法・実装順序・完了判定は [testArchitecture.md](./testArchitecture.md) に従う。

**今回は設計のみとし、編集対象は本書だけとする。** 既存コード、既存テスト、設計書、報告書は変更しない。本書に記載する修正後の結果は提案する仕様であり、実装済み・検証済みの結果ではない。

ユーザーの追加指定により、**DB未検証の事項は修正方針に含めない。** 対象は、実行済みのDB非接続テストで確認できた配列操作、戻り値、serviceの呼出し、入力検証、キー生成に限定する。

### 対象と根拠

| 修正ID | 修正対象 | 確認できた事実 | 元のケース |
| --- | --- | --- | --- |
| F1 | 商品画像の署名配列 | 署名の完了順によって返却配列から署名が欠落する。保存用URL配列の入力順は保持される | S13 / P06 / O03 |
| F2 | ブランド解決結果・別名作成の分岐 | 名前で見つかったブランドや新規aliasが返却結果へ採用されない。既存aliasがあっても作成serviceが呼ばれる経路がある | B03、B05〜B08 / Q03 / O02 |
| F3 | 商品画像0件の判定 | 空配列でも通過し、更新serviceへfirst_image_url=undefinedと空の画像配列が渡る | E04 / V10 / S08 / O01 |
| F4 | アップロードキーとuiIdの重複 | 同一ミリ秒の再実行でキーが一致する。同じリクエスト内の重複uiIdでは署名辞書が上書きされる | Q04 / P07 / V12 / O04 |

以下は今回の修正案・追加テスト設計の対象外とする。未確認のDB挙動から修正の必要性を断定しない。

- 別名が実DBで重複するか、商品更新の失敗後に残存するか。
- DB一意制約、マイグレーション、並行作成の排他制御。ブランド解決を商品transactionのcallback内で実行する順序は、追加指示に基づきテスト契約へ反映する。
- 実DBのrollback・commit後の可視性・外部キーやJSONBの保存結果。
- staleなモデル、所有者変更、削除、同時更新による競合（O05等）。
- 既知の型エラー、Router登録、共通エラー処理、今回の観測と無関係な改善。

## 2. 変更対象と責務

パスは `server/src/` からの相対パス。

| ファイル | 修正案 | 責務 |
| --- | --- | --- |
| `usecases/itemEditing/shared/buildSignedUrls.ts` | F1：署名配列の圧縮を並行処理の完了後へ移す。F4：リクエストごとに生成する識別子を新規キーへ加える | URLと署名情報の組立て |
| `usecases/itemEditing/shared/resolveBrand.ts` | F2：検索結果を明示的に返し、解決済みの場合の追加作成を止める | ブランド解決の業務分岐 |
| `usecases/itemEditing/updateConfirm.ts` | F3：確定した商品画像が0件なら既存AppErrorで停止する | 更新前の業務上の前提確認 |
| `validators/body/itemEditing.ts` | F4：colorVariants内でuiIdが重複していたら拒否する | リクエストの入力検証 |

serviceのDBアクセス実装、モデル制約は変更案に含めない。ブランド解決は、追加指示で確認した現行実装どおり商品transactionのcallback内で行う。F2では既存の `getBrand`、`getAliasOne`、`getBrandOne`、`createAliases` と `BrandResult` を利用できる。

ControllerとRouteに業務ロジックを追加しない。成功レスポンスは既存の署名4項目を維持する。新しい依存ライブラリは追加しない。

## 3. F1：商品画像の署名欠落を防ぐ

### 原因

現行helperは、並行処理中に `itemImageSignedUrls[index]` へ代入した直後、同じ配列をfilterして詰め直している。そのため、配列内の位置と元の入力indexの対応が変化し、後から完了した処理が別の署名を上書きする。

例えばindex 2の署名が先に完了すると、その要素がfilterによって配列の位置0へ移る。後からindex 0が完了すると、位置0の署名が置き換わる。

### 修正案

変更をこの原因に限定し、次の順序にする。

1. 各署名処理は元の入力indexへ結果を格納する。
2. 並行処理中は配列を圧縮・並べ替えしない。
3. `Promise.all` の完了後に、欠けている要素を一度だけfilterする。
4. 返却要素の `index` には、圧縮後の配列位置ではなく元の入力indexを残す。
5. `newUploadedUrls` と `finalImageUrls` の組立ては現在の入力index対応を維持する。

処理構造の例（実装コードではなく、変更位置を示す擬似コード）：

```text
await Promise.all(入力画像ごとの処理)
    新規アップロード対象の場合:
        署名をawaitする
        署名配列[元index] = { index: 元index, url: 署名 }
        新規公開URL配列[元index] = 公開URL

署名配列 = 署名配列から未設定要素を除去
入力順に既存URL／新規公開URLを選び、確定URL配列を作る
```

### 修正後の契約

- 新規署名対象1件につき、返却署名が必ず1件対応する。
- 返却配列は元indexの昇順とし、元indexとURLの対応を保持する。
- indexが飛び飛びでも、0始まりに付け直さない。
- 既存画像は署名配列へ追加せず、確定URL配列には従来どおり含める。
- 署名処理がrejectした場合はhelperもrejectする。既に開始した別のPromiseの取消しは保証しない。

## 4. F2：ブランド解決結果を返し、不要な別名作成を抑止する

### 原因と提案の範囲

現行処理には、`getBrandOne` で見つかったブランドや `createAliases` の結果を `brandResult` へ反映しない経路がある。また、brand付きaliasを採用した後も処理が続き、未紐付けaliasがある場合も作成へ進む。

本案では「検索で解決できた結果を商品更新の引数へ反映する」「既に利用できるaliasが返っているなら作り直さない」を提案する。これはhelperの分岐・戻り値・service呼出しで検証する。実DBにおける重複行の防止や既存データの整理は含めない。

### 修正後の分岐案

上から順に評価し、結果が決まったらreturnする。

| 順序 | 条件 | 戻り値 `{ brand, alias }` | 後続の検索・作成 |
| --- | --- | --- | --- |
| 1 | 指定brandIdに対応するブランドが存在 | `{ 指定ブランド, null }` | 名前検索・作成なし |
| 2 | 指定IDで解決せず、brand.nameがnullまたは空文字 | `{ null, null }` | 名前検索・作成なし |
| 3 | 正規化名で取得したaliasにbrandがある | `{ alias.brand, alias }` | ブランド名検索・追加作成なし |
| 4 | 上記で解決せず、正規化名に対応するブランドが存在 | `{ 名前で取得したブランド, null }` | 作成なし |
| 5 | ブランドが見つからず、未紐付けaliasが存在 | `{ null, 既存alias }` | 作成なし |
| 6 | ブランド・aliasとも存在せず、現行の作成条件を満たす | `{ null, 新規作成alias }` | createAliasesを1回 |
| 7 | いずれにも該当しない | `{ null, null }` | 作成なし |

分岐上の注意点：

- 有効なID指定を最優先にする。存在しないIDを404にする変更は含めず、現在と同様に名前へのfallbackを許す。
- brand付きaliasを、名前検索結果より優先する現行の方針を維持する。
- 未紐付けaliasと名前検索のブランドが両方ある場合は、ブランドのみ採用する。無関係なaliasをそのブランドへ自動的に紐付けない。
- 新規aliasの返却は既存の `BrandResult` で表せる。usecaseの既存処理により、更新引数のbrand_idはnull、brand_aliases_idはそのalias.idになる。実DB保存の成否は本書の確認範囲外。
- 正規化方法、正規化前の `inputName.length >= 2` という作成条件は変更しない。空白だけの名前や絵文字の扱い（B09）は、名称入力の別仕様として今回広げない。
- brand.nameが未指定の場合は、解決結果をnullにする現在の挙動を維持する。

### 重複実行で確認する範囲

初回に作成した未紐付けaliasを、2回目の検索serviceが返した場合、2回目はそのaliasを再利用して作成serviceを呼ばない。

この確認は、検索結果を指定したモックテストで行う。並行する2件の検索が両方とも未登録を返す場合まで重複作成を防ぐ保証は追加しない。Q03のservice呼出し分岐だけを更新し、P05のDB側対策は今回の修正案に含めない。

### transactionへの影響

ブランド解決とcreateAliasesは、追加指示の意図に合わせ、商品更新transactionのcallback内で行う。期待する順序は「数値・マスター検証→transaction開始→ブランド解決・必要な別名作成→本体更新→画像更新」とする。

- ブランド解決が完了するまで本体・画像更新とcallback完了へ進まない。
- ブランドserviceが失敗した場合、transactionは開始済みであり、同一エラーがcallbackからusecaseへ伝播する。後続のブランドserviceと商品更新は実行しない。
- transaction開始に失敗してcallbackが呼ばれなければ、ブランド解決も実行しない。
- 本体更新失敗時はcallbackが同一エラーでrejectし、画像更新へ進まない。T05はこの順序と伝播を検証する。

今回のテスト修正はcallback内の実行順序を対象とする。現行のresolveBrand/createAliasesにはtransaction引数がなく、createAliasesのModel.createにも明示的なtransaction指定はないため、callback内での呼出しだけを根拠にDB操作が同一transactionへ参加しているとは判定しない。引数追加やDBのrollback検証は今回行わない。

## 5. F3：確定した商品画像が0件なら更新を止める

### 原因

配列の存在のみを確認する `if (!finalImageUrls)` では、空配列が通過する。DBで何が保存されるかは未検証だが、更新引数のfirst_image_urlがundefinedになることは確認済み。

### 修正案

商品情報の確定更新では「利用できる商品画像が1件以上あること」を前提とする案を採る。usecaseの現在の画像チェック位置で、空配列も拒否する。

```ts
if (!finalImageUrls || finalImageUrls.length === 0) {
    throw new AppError("ITEM_IMAGE_NULL", 400);
}
```

- エラーコードとHTTPステータスは既存のものを使用する。
- 動画URL → サムネイルURL → 商品画像の検証順は維持する。
- 数値検証、マスター検証、ブランド解決、transaction、両更新serviceへ進めない。
- 判定対象は入力のitemImages件数ではなく、helperが組み立てた確定URL件数とする。入力があっても、既存index不在やtype不足で全件除外される場合を含む。
- schemaに商品画像件数の下限は追加しない。空の入力配列をschemaが受理するV10と、確定画像0件をusecaseが拒否するケースを分ける。
- 商品画像1件以上のときの引継ぎ、順序、先頭画像の選択は維持する。一部だけ画像が確定しない場合の扱いや画像上限変更は追加しない。

これは更新serviceに不完全な引数を渡さないための修正であり、DB上の旧先頭画像残存を確認したうえでの修正ではない。

## 6. F4：別リクエストのキー共有と同一リクエストのuiId重複を分けて防ぐ

### F4-a：同一ミリ秒の別リクエスト

`Date.now()` だけに依存せず、`buildSignedUrls` の1回の呼出しごとにNode.js標準の `node:crypto` の `randomUUID()` で識別子を生成する案とする。新しいライブラリは不要。

時刻と既存プレフィックスを残し、新規アップロードキーに識別子を追加する。

| メディア | キーの提案 |
| --- | --- |
| 動画 | `video/original/{userId}/{itemEditingId}_{now}_{requestId}` |
| サムネイル | `thumbnail/{userId}/{itemEditingId}_{now}_{requestId}` |
| 商品画像 | `item-image/{userId}/{itemEditingId}_{index}_{now}_{requestId}` |
| 属性画像 | `attributes/{userId}/{itemEditingId}_{uiId}_{now}_{requestId}` |

- 1回のhelper呼出しでは同じrequestIdを使用する。ファイル間の識別には従来のプレフィックス・index・uiIdを使う。
- 署名関数へ渡すkeyと、保存用の公開URLへ組み込むkeyは必ず同一にする。
- 既存URLを再利用する場合、そのURLは書き換えない。
- レスポンスの項目・型は変更せず、requestIdを新しいレスポンス項目として追加しない。
- これは時刻だけによる衝突を避ける方策であり、全リクエストでの数学的な一意性や、リクエスト再送の冪等性を保証するものではない。
- 実装前にはキーを受け取る動画処理等に末尾形式への依存がないか確認する。既存キーを読み替える移行は行わない。

### F4-b：同じリクエストの重複uiId

requestIdを追加しても、同じリクエスト内でuiIdが重複していれば属性のキーと返却辞書を共有する。この問題は入力検証で扱う。

`updateItemEditingConfirmBodySchema` のcolorVariants配列に、uiIdの一意性を検証するrefinementを追加する案とする。`Set<string>` で出現済みuiIdを確認し、2件目以降の該当uiIdに検証エラーを付ける。

- 比較は現在の文字列の完全一致とする。trim、小文字化、IDの自動再採番は行わない。
- 重複があれば既存のvalidateBodyを通じて `INVALID_BODY / 400` にする。
- 画像あり／なし、uploadedの値にかかわらず同じcolorVariants配列内の重複を拒否する。
- 色配列0件・1件・一意な複数件は受理する。uiIdの文字種や長さ、空文字そのものの禁止は今回追加しない。ただし空文字が複数件あれば重複として拒否する。
- 正常HTTP経路ではcontroller・usecase・署名処理へ到達しない。
- helper内に同じschema検証を追加しない。直接helperへ不正な重複uiIdを渡した場合まで保護したと主張しない。

## 7. 修正後のテスト方針

### 元の設計方針の引継ぎ

| レベル | 方針 | 既存の主なファイル |
| --- | --- | --- |
| U | usecaseを実行し、依存helper/serviceとtransactionはVitestでモック。更新引数・処理順序・例外・後続未実行を検証 | `usecase.test.ts` |
| H | helper実装を使用。DB service、S3署名、時刻、requestId生成をモック | `signedUrls.test.ts`、`masterBrand.test.ts` |
| V | 実schemaとvalidateBodyを使用し、入力の受理・拒否を検証 | `validation.test.ts` |
| C/R | 実controllerまたはテスト用Expressに接続したRouterを使用。usecaseをモック | `controller.test.ts`、`route.test.ts` |
| service単体 | 今回service実装の変更は提案しない。既存の呼出契約の回帰確認を維持 | `services.test.ts` |
| DB結合 | 今回の修正方針・追加ケース設計の対象外 | 作成・実行しない |

- Vitestを使用し、Router結合には既存のSupertestを用いる。
- テスト名には本書のAFケースID、元のケースID、条件と期待結果を含める。
- 同じID内の複数条件は `it.each` 等で独立ケースへ展開する。
- AppErrorは型・code・statusCodeを、予期しない例外は同一オブジェクトの伝播を検証する。
- 並行署名はdeferred Promiseで完了順を制御する。sleepやランダムな実行順には依存しない。
- requestIdは既知の異なる値を順に返すモックにする。実UUIDの統計的な衝突試験や固定文字列へのスナップショット比較を目的にしない。
- helperを全モックしたUだけでF1・F2・F4の解決を確認したことにはしない。実helperとの組合せも検証する。

### 9つの観点への対応

| 観点 | 今回確認する範囲 |
| --- | --- |
| 正常系 | 署名の全件返却、ブランド採用、商品画像1件以上、一意uiId |
| 異常系 | 確定画像0件、重複uiId、署名・ブランドserviceの例外と後続停止 |
| 境界値 | 画像0/1/10件、uiIdの0/1/2件、同一時刻、飛び飛びのindex |
| 条件分岐 | ブランドの優先順位、既存/新規画像、情報不足、採用済み結果からの早期return |
| 状態遷移 | 2回目の検索でaliasが返ったときの再利用、画像再利用から新規署名への切替。永続状態は扱わない |
| DB整合性 | 対象外。更新引数の整合性だけはU/Hで確認し、DB保証と区別 |
| トランザクション | 画像0件で未開始、transaction内のブランド解決と例外伝播、更新serviceへの同一transaction引渡しと完了待ちを確認。DBのrollback検証は含めない |
| 重複実行 | 同じ時刻でも別requestIdでキーが分かれること、既存alias返却時の作成呼出し抑止 |
| 並行処理 | 署名完了順を変えても欠落・対応ずれがないこと。DB並行更新・別名の同時作成制御は対象外 |

## 8. 追加・変更するテストケース

以下は修正後の期待結果。現時点で実装・実行はしていない。

### F1：署名配列

| 新ID | 元のケース | レベル | 入力・手順 | 修正後の期待結果 |
| --- | --- | --- | --- | --- |
| AF-S01 | S13 / P06 / O03 | H | 新規index=[0,1,2]、完了順を正順・逆順・混在にする | すべて返却index=[0,1,2]、件数3、URL対応一致、重複なし |
| AF-S02 | S13 / O03 | H | 新規index=[1]、[0,2]、[1,3]。複数件は逆順でも完了させる | 返却indexはそれぞれ[1]、[0,2]、[1,3]。元indexを付け替えない |
| AF-S03 | S05 / S06 | H | 既存・新規を交互に指定 | 新規の署名だけを全件返し、確定URLは既存分を含め入力順 |
| AF-S04 | S08 / V10 | H | 署名対象0件・1件・10件 | 件数が対象数と一致。0件でも既存画像があれば確定URLは維持 |
| AF-S05 | E11 | H/U | 複数署名のうち1件をreject | 同一エラーを伝播し、実helper経由のusecaseでは商品更新へ進まない。開始済みPromiseの取消しはassertしない |
| AF-S06 | N01 / N02 / R02 | H/U/C | 元indexが飛び飛びの結果をusecaseとcontrollerへ渡す | 署名4項目の型とindexを維持。first_image_urlは確定URLの先頭、画像更新には全確定URLを渡す |

### F2：ブランド解決

| 新ID | 元のケース | レベル | 入力・手順 | 修正後の期待結果 |
| --- | --- | --- | --- | --- |
| AF-B01 | B01 / B02 | H | 有効ID、存在しないID＋名前、IDなし＋名前なし | 有効ID優先。存在しないIDは名前へfallback。名前なしは両方null |
| AF-B02 | B03 / B08 | H | brand付きaliasが返る | そのbrand・aliasを返す。getBrandOneとcreateAliasesは未実行 |
| AF-B03 | B05 / O02 | H/U | aliasなし、名前検索でブランドが返る | ブランドを採用。更新引数brand_idにそのID、brand_aliases_idにnull。作成なし |
| AF-B04 | B07 / O02 | H/U | 未紐付けaliasあり、ブランド名検索の結果がnull | 既存aliasを返し、更新引数brand_id=null・brand_aliases_id=既存ID。作成なし |
| AF-B05 | B05 / B07 | H/U | 未紐付けaliasと名前検索ブランドが両方ある | ブランドのみ採用。既存aliasの紐付け更新や作成を呼ばない |
| AF-B06 | B06 / O02 | H/U | 検索結果なし、2文字以上で新規aliasを作成 | 作成1回、そのaliasを返す。更新引数brand_aliases_idへ新規IDを渡す |
| AF-B07 | B04 / B06 / B09 | H | 元名0/1/2文字、全半角・カナ・空白・絵文字 | 現行の正規化と作成条件を維持。作成した場合のalias返却だけを変更 |
| AF-B08 | Q03 / O02 | H/U | 初回は未登録→作成、2回目の検索はその未紐付けaliasを返す | 2回とも同じalias.idを採用し、createAliasesの合計呼出しは1回。DB件数はassertしない |
| AF-B09 | B10 / E11 | H/U | getBrand、getAliasOne、getBrandOne、createAliasesをそれぞれreject | 呼び出される分岐を用意し、transaction開始後の同一エラーのcallback/usecaseへの伝播、後続ブランドservice・商品更新の未実行を確認 |
| AF-B10 | N01 / T01 / T02 / T05 | U/H | ブランド解決成功後に商品更新を実行 | 商品transaction→ブランド解決→本体→画像の順序を確認。ブランド解決中の更新・callback完了待ち、更新serviceへの同一t引渡し、開始失敗時のブランド解決未実行、本体更新失敗の伝播を確認。別名のDB残存は扱わない |

### F3：商品画像0件

| 新ID | 元のケース | レベル | 入力・手順 | 修正後の期待結果 |
| --- | --- | --- | --- | --- |
| AF-I01 | E04 / O01 | U | helper結果を[]、null、undefinedとし、既存先頭画像あり/なしを組み合わせる | ITEM_IMAGE_NULL/400。数値・マスター・ブランド・transaction・更新serviceは未実行 |
| AF-I02 | V10 / O01 | V/H/U | itemImages=[]を実schemaと実helperへ渡す | schemaは受理、確定配列は[]、usecaseがITEM_IMAGE_NULL/400を返す |
| AF-I03 | S06 / S08 | H/U | 入力画像はあるが、既存URL不在・新規type不足で全件除外される | 入力件数にかかわらずITEM_IMAGE_NULL/400。商品更新なし |
| AF-I04 | N02 / D04 | U/H | 確定画像1件・10件 | 更新を実行。first_image_urlと画像配列の先頭が一致し、全件を更新serviceへ渡す。永続化は扱わない |
| AF-I05 | E15 | U/H | 動画・サムネイル・画像配列の不備を重ねる | 動画→サムネイル→商品画像のエラー優先順位を維持 |
| AF-I06 | R03 | C/R | usecaseがITEM_IMAGE_NULLをreject | controllerはnextへ同一AppErrorを渡し、200を返さない。Routerはテスト用エラー観測middlewareで400を確認 |

### F4：キー生成・uiIdの一意性

| 新ID | 元のケース | レベル | 入力・手順 | 修正後の期待結果 |
| --- | --- | --- | --- | --- |
| AF-K01 | Q04 / O04 | H | 同一時刻・同一商品・同一入力で2回実行し、requestIdモックだけ変える | 動画・サムネイル・商品画像・属性画像の各新規キーが呼出し間で異なる |
| AF-K02 | S01 / S04 / S05 / S09 | H | 1回で全メディアを新規指定 | 1回生成したrequestIdを使用し、署名keyと公開URLのkeyが一致。元index・uiIdは保持 |
| AF-K03 | S02 / S10 / Q01 | H | 動画・商品画像・属性画像等を既存利用 | 既存URLを書き換えず、不要なS3署名を呼ばない |
| AF-K04 | Q02 / P06 | H | 時刻を変えた再実行、同時開始して別requestIdを割当て、署名を逆順完了 | 各呼出し内のURL対応を保持し、別呼出しの署名結果を混ぜない。再送への同一結果は保証しない |
| AF-K05 | E11 | H/U | requestId生成がthrow、またはキー生成後の署名がreject | エラーを伝播して商品更新へ進めない |
| AF-V01 | V12 / P07 / O04 | V/R | uiIdが同じ2件。画像あり/なし、uploaded=true/falseを組み合わせる | schema拒否、INVALID_BODY/400。controller/usecase未実行 |
| AF-V02 | V12 / N05 | V/H | 色0件・1件・一意な複数件、色の並べ替え | schema受理。各uiIdと署名・既存画像の対応を維持 |
| AF-V03 | V12 | V | 1件だけ空uiId、空uiIdが2件、同一uiIdが離れた位置にある | 1件の空文字は受理、重複は位置によらず拒否。勝手にtrim・再採番しない |
| AF-V04 | V16 / R05 / R07 | V/R | 重複uiIdのbody、paramsも不正なリクエスト、重複bodyの繰返し | 既存のparams優先・認証・レート制限順序を維持。body不正も制限回数に加算 |

## 9. 既存テストの移行方針

既存の観測テストをそのまま残すと、不具合の現行結果を期待するassertが修正後に失敗する。修正時は次の対応を行う。本書作成時点では変更しない。

| 既存テスト | 修正時の扱い |
| --- | --- |
| S13 / P06 / O03：署名欠落を期待するケース | AF-S01/S02へ変更し、欠落なし・全index対応を期待する。旧結果はtestReport.mdの履歴に残す |
| B03 / B05〜B08 / O02：未採用や不要な作成を期待するケース | AF-B02〜B06の分岐表へ置換。brand=null・aliasありの更新引数も追加検証 |
| Q03：同じ未紐付けaliasが返っても作成2回を期待するケース | AF-B08へ変更。検索結果を指定した逐次再実行の確認に限定 |
| E04 / O01：空配列が更新へ進むケース | AF-I01へ変更し、空配列も400・後続未実行を期待 |
| V10：schemaが画像0件を受理するケース | 維持。usecaseの0件拒否とは責務を分ける |
| Q04：同一時刻のキー一致を期待するケース | AF-K01へ変更。時刻とrequestIdを別々にモック |
| S01 / S04 / S05 / S09等のキー文字列比較 | requestId込みの期待値へ変更。署名と公開URLの対応assertは維持 |
| V12：重複uiIdを受理するケース | 重複部分をAF-V01/V03へ置換。空配列・素材比率合計など無関係な受理条件は維持 |
| P07：helper直接呼出しで辞書上書きを期待するケース | HTTPの入力契約を確認するAF-V01へ移す。helper直接呼出しまで拒否されるとは期待しない |
| N01、ブランド関連のservice呼出順・回数 | 解決後の早期returnを反映。追加指示に合わせ、商品transaction開始後にブランド解決を実行する期待値へ変更。T05もcallback内の別名作成・本体更新失敗の伝播へ移行 |
| その他の正常系・認証・認可・価格/在庫境界・エラー伝播 | 原則として既存期待値を維持し回帰確認 |

既存436件という件数の維持やカバレッジ100%を完了条件にしない。仕様が変わるケースだけ期待結果を更新し、無関係なassertを弱めない。失敗したテストをskipやtodoにして成功扱いにしない。

## 10. 実装順序と完了判定

### 実装順序

元のtestArchitecture.mdのP0 → P1 → P2に合わせる。

1. **P0：基本動作・異常時停止** — F1の署名件数とindex対応、F3の空画像拒否、F2の返却結果と更新引数、F4-bの重複uiId拒否をケースごとに実装する。修正前の再現条件と修正後の期待結果を対にする。
2. **P1：helper・入力境界・接続** — ブランドの全分岐と例外、キーの全メディアへの適用、既存URL引継ぎ、validatorからcontroller/Routerまでの接続を確認する。
3. **P2：重複実行・並行処理** — 正順・逆順・混在・疎index、同一時刻の別requestId、検索済みaliasの再利用を確認する。DB未検証事項への対策は追加しない。

### 完了条件

- F1〜F4の対象ファイルだけに必要な変更を行い、上記の修正後の契約を満たす。
- AFケースの実処理・モック範囲が明確で、観測テストを新しい期待結果へ移行できている。
- 異常系はエラーだけでなく、後続検証・署名・更新の未実行を適切な境界で確認できている。
- 署名の各完了順で、件数・元indexの一意性・URL対応・確定URL順序が一致する。
- ブランドの戻り値、必要なserviceだけを呼ぶこと、商品更新へ渡すIDを確認できている。
- transaction開始後にブランド解決を行い、その完了前には更新へ進まない。ブランド解決失敗時はcallback/usecaseへ同一エラーを伝播し、商品更新へ進まない。
- 既存の所有権取得、成功レスポンス、transaction引渡し・完了待ち、認証・レート制限の回帰テストが通る。
- DB未検証の事項について成功・修正完了と記載しない。今回の完了はDB非接続で検証できる修正範囲に限定する。

実装時の確認コマンド（`server/` で実行）：

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

既存ESLint設定がテストTSを検査しない場合は、前回同様に対象テストへtypescript-eslintの検査を別途適用する。既知のエラーは修正せず、新しい変更に起因するエラーと区別する。

本書作成時点ではコード・テストを変更していないため、これらのコマンドの再実行や、修正後の成功判定は行っていない。

---

## 修正レポート

> 以下は順序の意図が確認される前の実行履歴。現在の設計は上記各節へ反映済みであり、最新の判定は末尾の「再修正レポート」を参照する。

### 実施結果

第8〜10節に基づき、F1〜F4の追加・移行テストを実装した。対象ディレクトリの7テストファイルを実行した結果は、**502件中494件成功、8件失敗、skip/todoなし**だった。追加テストの実装は完了したが、ブランド解決とtransaction開始の順序が本書の契約と一致しないため、全件成功の完了条件は未達である。

今回変更したのは、このディレクトリのテスト6ファイル、共通fixture、本レポートだけである。`services.test.ts`は変更せず回帰確認した。実装コード、`testArchitecture.md`、過去の観測結果を記録した`testReport.md`は変更していない。

### 追加・移行内容とAFケースの結果

モックはVitestを使用した。service・S3署名・transactionをモックし、helper、schema、validateBody、controller、Routerは各テストの責務に応じて実処理を呼び出している。署名の完了順はdeferred Promise、requestIdは`randomUUID`の固定応答で制御した。DBへの接続は行っていない。

以下は31個のAFケースIDの対応表である。同じIDを複数条件やレイヤーで検証しているため、ID数と実行テスト件数は一致しない。

| 対象ID | 主なファイル | 結果・確認内容 |
| --- | --- | --- |
| AF-S01〜S04 | `signedUrls.test.ts` | 成功。正順・逆順・混在、疎index、既存と新規の混在、署名対象0/1/10件で、件数・index・URL対応と確定URL順を確認 |
| AF-S05 | `masterBrand.test.ts` | 成功。実helper内の署名失敗を同一エラーとして伝播し、マスター検索・商品更新へ進まない |
| AF-S06 | `masterBrand.test.ts`、`controller.test.ts` | 成功。疎indexを含む署名4項目の返却、先頭画像と全画像の更新引数を確認 |
| AF-B01〜B07 | `masterBrand.test.ts` | 成功。ID指定、紐付け済みalias、正式ブランド、未紐付けalias、新規作成の優先順位、名前の境界・正規化、更新へ渡すIDを確認 |
| AF-B08 | `masterBrand.test.ts` | 成功。2回目の検索で既存aliasを返すモックにより再利用を確認。作成serviceの合計呼出しは1回 |
| AF-B09 | `masterBrand.test.ts` | **失敗（4件）**。各ブランドserviceの例外は伝播するが、例外発生前にtransactionが開始されている |
| AF-B10 | `masterBrand.test.ts`、`usecase.test.ts` | **一部失敗**。ブランド解決完了前のtransaction開始を検出。同一transactionの更新serviceへの引渡し、本体・画像更新とtransaction完了の待機は確認できた |
| AF-I01 | `usecase.test.ts` | 成功。確定画像が空配列/null/undefinedの場合、既存先頭画像の有無によらず400で後続未実行 |
| AF-I02〜I04 | `masterBrand.test.ts` | 成功。schemaが受理する画像0件、実helperが全件除外する入力、確定画像1/10件を実usecaseへ接続して確認 |
| AF-I05 | `usecase.test.ts` | 成功。動画→サムネイル→商品画像のエラー優先順位を維持 |
| AF-I06 | `controller.test.ts`、`route.test.ts` | 成功。ITEM_IMAGE_NULLの同一AppErrorをnextへ渡し、テスト用エラーmiddlewareを通じてHTTP 400を確認 |
| AF-K01〜K04 | `signedUrls.test.ts` | 成功。同一時刻の別requestId、1呼出し内のキー対応、既存URL保持、異なる時刻や並行実行での結果の分離を確認 |
| AF-K05 | `masterBrand.test.ts` | 成功。UUID生成失敗、および動画・サムネイル・商品画像・属性画像の署名失敗で商品更新へ進まない |
| AF-V01 | `validation.test.ts`、`route.test.ts` | 成功。画像なし・新規・既存の組合せ9通りで重複uiIdを拒否し、INVALID_BODY/400、usecase未実行を確認 |
| AF-V02 | `validation.test.ts`、`signedUrls.test.ts` | 成功。色0/1/複数件と並べ替えを受理し、uiIdと画像URLの対応を維持 |
| AF-V03 | `validation.test.ts` | 成功。単独の空文字は受理し、空文字や離れた位置の重複は拒否。trim・大小文字変換を行わない |
| AF-V04 | `route.test.ts` | 成功。認証・params検証の優先順位を維持し、重複bodyによる400もレート制限回数に加算 |

署名欠落、不要なalias作成、空画像での更新継続、同一時刻のキー一致、重複uiId受理を期待していた観測テストは、修正後の契約へ移行した。画像0件のschema受理、素材比率合計など無関係な入力条件の期待値は維持している。失敗するケースをskip/todoにしたり、現行実装に合わせて順序のassertを弱めたりしていない。

### 失敗8件の原因と完了判定

本書では「ブランド解決→商品transaction開始→本体更新→画像更新」の順序を要求している。一方、現行の`server/src/usecases/itemEditing/updateConfirm.ts`は、`sequelize.transaction`のcallback内で`resolveBrand`を呼び出している。これにより、次の8件が失敗した。

| ファイル・ケース | 件数 | 設計書と異なる観測結果 |
| --- | --- | --- |
| `masterBrand.test.ts`：AF-B09 | 4 | getBrand/getAliasOne/getBrandOne/createAliasesの各例外発生時、transactionの呼出し回数が期待値0回に対して1回 |
| `masterBrand.test.ts`：AF-B10 | 1 | alias作成が未完了の時点でtransactionが開始済み。呼出し順も設計と逆 |
| `masterBrand.test.ts`：既存T05 | 1 | alias作成の呼出しが商品transaction開始より後 |
| `usecase.test.ts`：既存N01/N02/N05/T01 | 1 | 正常時のブランド解決とtransaction開始の順序が逆 |
| `usecase.test.ts`：既存E11/E12/E13/T06のresolveBrand例外 | 1 | resolveBrandが失敗してもtransactionは呼出し済み |

F1・F3・F4の追加テスト、およびF2のブランド採用・再利用は成功した。既存の認証・認可、入力境界、レスポンス、更新引数、transaction引渡しと完了待ちも対象テストで確認した。ただし、F2の処理順序と異常時のtransaction未開始については契約未達であり、修正全体の完了とは判定しない。

今回許可された範囲はテストディレクトリ内に限られるため、実装コードは修正していない。DBの永続化、rollback、aliasの残存や並行更新の整合性については検証も成功判定も行っていない。transaction callback内で呼んでいることだけから、ブランドserviceに同じtransactionが適用されるとは判断しない。

### 実行コマンドと詳細結果

`server/`で次を実行した。テスト結果の集計にはVitestのJSONレポートを使用した。

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/ --reporter=json --outputFile=/tmp/afterfix-tests.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| テストファイル | 成功 | 失敗 | 合計 |
| --- | ---: | ---: | ---: |
| `controller.test.ts` | 5 | 0 | 5 |
| `masterBrand.test.ts` | 144 | 6 | 150 |
| `route.test.ts` | 22 | 0 | 22 |
| `services.test.ts` | 4 | 0 | 4 |
| `signedUrls.test.ts` | 60 | 0 | 60 |
| `usecase.test.ts` | 48 | 2 | 50 |
| `validation.test.ts` | 211 | 0 | 211 |
| **合計** | **494** | **8** | **502** |

`npm run lint`は成功した。既存設定ではテストTSが検査対象外のため、対象ディレクトリの8個のTSファイルへ、ESLint APIでtypescript-eslintのrecommended設定を別途適用し、エラー・警告ともに0件だった。

型検査は既知の対象外エラーにより失敗した。`npm run typecheck`では`src/controllers/items.ts`のexport不一致1件と`src/usecases/items/upload/uploadDraft.ts`のimport先不在4件、テスト用tsconfigでは`shopSignup/signup1.test.ts`と`signup5.test.ts`のimport先不在2件が報告された。今回変更したテストファイルに型エラーは報告されていない。これらの既知エラーは変更していない。

## 再修正レポート

### 再修正の理由と対象

ブランド解決とcreateAliasesを商品transactionのcallback内で実行する順序は、意図した変更であることが確認された。この指示を設計の前提として、第3・5・7〜10節の関連記述と、`usecase.test.ts`・`masterBrand.test.ts`の期待値を修正した。前回の修正レポートは実行履歴として残しているが、そこでの「順序の不一致による未達」という判定は本レポートで更新する。

今回変更したファイルは、このディレクトリ内の上記テスト2ファイルと`afterFix.md`のみ。実装コード、DB、その他のテストファイルは変更していない。

### 更新したテスト契約

期待する順序を「事前検証→transaction開始→ブランド解決・必要な別名作成→本体更新→画像更新」とした。

| 対象 | 更新・確認内容 | 結果 |
| --- | --- | --- |
| AF-B09（4件） | 各ブランドserviceの例外発生時はtransaction開始済みとし、transactionの返却Promiseとusecaseが同じエラーでrejectすること、後続service・商品更新の未実行を確認 | 成功 |
| AF-B10：ブランド解決待機 | 別名作成を保留している間はtransaction開始済みで、本体・画像更新とcallback完了には進まない。解決後は順序どおり更新し、両更新serviceに同じtを渡す | 成功 |
| AF-B10 / T05：本体更新失敗 | transaction開始後に別名を作成し、本体更新で失敗した場合は同じエラーを伝播して画像更新へ進まない | 成功 |
| N01 / N02 / N05 / T01 | 正常時の呼出し順をtransaction開始→ブランド解決へ変更。保存引数・返却項目の検証は維持 | 成功 |
| E11 / E12 / E13 / T06 | ブランド解決より前の事前処理失敗ではtransaction未開始。ブランド解決以降の失敗では開始済みで、transactionの返却Promiseにも同一エラーが伝播 | 成功 |
| E14 | transaction開始失敗でcallbackが呼ばれない場合はブランド解決未実行。完了時の失敗ではブランド解決実行済みであることを追加確認 | 成功 |

失敗テストを削除・skip化せず、変更された契約に対応するassertへ移行した。ブランド解決、本体更新、画像更新、transaction完了の待機、および異常時の後続未実行は引き続き検証している。

### 再実行結果

`server/`で実行：

```bash
npm run test:run -- test/usecases/itemEditing/updateConfirm/ --reporter=json --outputFile=/tmp/afterfix-revised-tests.json
npm run lint
npm run typecheck
./node_modules/.bin/tsc --noEmit -p test/tsconfig.json
```

| テストファイル | 成功 | 失敗 | 合計 |
| --- | ---: | ---: | ---: |
| `controller.test.ts` | 5 | 0 | 5 |
| `masterBrand.test.ts` | 150 | 0 | 150 |
| `route.test.ts` | 22 | 0 | 22 |
| `services.test.ts` | 4 | 0 | 4 |
| `signedUrls.test.ts` | 60 | 0 | 60 |
| `usecase.test.ts` | 50 | 0 | 50 |
| `validation.test.ts` | 211 | 0 | 211 |
| **合計** | **502** | **0** | **502** |

**7ファイル・502件がすべて成功し、skip/todoは0件。** 前回失敗した8件はすべて成功した。F1〜F4のAFケースと既存の回帰テストは、更新した呼出し順の契約を満たしている。

`npm run lint`は成功。変更したテストTSの2ファイルへ、ESLint APIでtypescript-eslintのrecommended設定も別途適用し、エラー・警告ともに0件だった。

型検査は前回と同じ既知の対象外エラーのみで失敗した。アプリ側は`src/controllers/items.ts`のexport不一致1件と`uploadDraft.ts`のimport先不在4件、テスト側は`shopSignup/signup1.test.ts`・`signup5.test.ts`のimport先不在2件である。今回変更したファイルの型エラーは報告されておらず、既知エラーは修正していない。

### 完了判定と検証範囲

今回依頼された、意図した実行順序への設計・テストの再修正と、対象テストの全件成功を確認した。DB非接続で検証する呼出し順・待機・例外伝播の範囲では完了とする。

これはcreateAliasesのDB操作が商品更新と同じtransactionへ参加し、更新失敗時にrollbackされることの確認ではない。現行コードはresolveBrand/createAliasesへtを明示的に渡しておらず、Model.createにもtransaction指定がない。DBへの参加・rollback・永続化の整合性は今回の検証対象外であり、成功とは判定していない。
