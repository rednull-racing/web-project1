# 登録中の代表者氏名編集で参照先と更新先のIDを揃える

## 問題と原因

`/edit/name/shop/rep-name/signup/[id]`はShopSignupの代表者氏名を取得するが、保存時は同じIDで`PATCH /shop-info/:id/rep-name`を呼ぶ。取得先はShopSignup、更新先はShopInfoで、IDが同じショップを指す保証がない。更新対象が見つからない場合や、同じユーザーの別ショップが同じIDを持つ場合の誤更新につながる。

## 修正方針・実装内容

登録中の編集対象がShopSignupかShopInfoかを確認し、画面の取得・保存・遷移先を同じ対象に揃える。登録中はShopSignupを更新する仕様なら、所有権チェックを行う更新APIを接続し、氏名と身分証を同じ対象へ保存する。ShopSignupとShopInfoのIDが異なるケースをテストする。

## 対象・参照ファイル

- `client/src/app/edit/name/shop/rep-name/signup/[id]/page.tsx`
- `client/src/app/edit/name/nameEditForm.tsx`
- `client/src/app/edit/api/name/server.ts`
- `client/src/app/edit/api/name/client.ts`
- `server/src/usecases/shopInfo/edit/repName.ts`
- `server/src/usecases/shopSignup/edit/signup3/signup3.ts`

## 注意事項

2026-09-18のアップロード方式変更では、RepresentativeNameの取得・更新方法を変更しない指定があるため修正していない。取得・更新対象の変更は別タスクとして確認してから行う。認証・所有権チェックを維持する。
