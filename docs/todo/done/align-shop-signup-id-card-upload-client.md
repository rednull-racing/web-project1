# ショップ登録の身分証アップロード方式をサーバーと揃える

## 問題の概要

`PATCH /shop-signup/:id/id-card` は実ファイルのBufferを受け取る実装だが、フロントエンドはファイル名などのメタデータをJSONで送信している。このままではbody validationを通過せず、身分証を登録できない。

## 原因

サーバーはS3への直接アップロード方式へ変更されているが、フロントエンドには署名付きURLを取得してアップロードする旧方式が残っている。

## 修正方針

`shop-info-edit`の身分証アップロードと同様に、フロントエンドから実ファイルを`FormData`で送信する。サーバーの共通multipart middlewareと入力schemaに合うリクエストに統一する。

## 対象ファイル

- `client/src/app/shop-signup/api/step3.ts`
- `client/src/app/shop-signup/step3/form.tsx`

## 参照すべきファイル

- `client/src/app/edit/api/shop/shopEdit/client.ts`
- `server/src/routes/shopSignup.ts`
- `server/src/validators/body/shopSignup.ts`
- `server/src/usecases/shopSignup/signup3/signup3.ts`

## 実装内容

- APIクライアントのbody型を表面画像、裏面画像、許認可証画像の実ファイル型へ変更する。
- `FormData`へ各ファイルを追加し、認証トークン付きでAPIへ送信する。
- 署名付きURLを前提としたレスポンス型と、クライアント側のS3 PUT処理を削除する。
- 成功時と失敗時の既存UI挙動を維持する。

## 実装時の注意事項

- `Content-Type`は手動設定せず、ブラウザにmultipart boundaryを設定させる。
- ファイルフィールド名は`frontIdCard`、`rearIdCard`、`permitFiles`を使用する。
- 許認可証は最大10件というサーバー側の制約を維持する。
- 新しいライブラリは追加しない。

---

## 報告

submit() と fetchStep3() を完成させました。

- FormDataで表面・裏面・許認可証を送信
- Bearer認証を付与
- API仕様どおり PATCH /shop-signup/:id/id-card を使用
- 必須ファイルと許認可証のチェックを実装
- 旧Presigned URLアップロード処理を削除

変更ファイル：

- client/src/app/shop-signup/step3/form.tsx:98
- client/src/app/shop-signup/api/step3.ts:10

確認結果：

- 対象ファイルのESLint：成功
- TypeScript：別箇所の既存エラーにより失敗
    - form.tsx の既存プロパティ参照
    - step5関連の型エラー

指示どおり、それらのエラー箇所は編集していません。
