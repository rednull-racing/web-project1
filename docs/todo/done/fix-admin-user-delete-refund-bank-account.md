# 管理者によるユーザー削除時の返金口座参照を修正する

## 問題の概要

管理者がユーザーを削除した際、そのユーザーが出品した取引中商品を購入者へ返金する処理で、購入者ではなく削除対象ユーザーの口座情報が振込スナップショットへ保存されている。

購入者の口座登録有無を案内する通知文も条件が逆転しており、口座登録済みの購入者へ「口座情報が未登録」と通知する。

## 原因

`deleteUserAdminUseCase`は処理冒頭で削除対象ユーザーの `BankAccount` を `account` として保持している。取引キャンセル処理では購入者を `getUserHasBankAccount` で取得しているが、`createTransfer` の `bank_snapshot` には購入者の口座ではなく、処理冒頭の `account` を使用している。

また、`buyerHasAccount` がtrueの場合に未登録案内を連結している。

## 修正方針

返金先の `bank_snapshot` は、各注文の購入者に紐づく `BankAccount` から作成する。購入者または購入者の口座が存在しない場合の業務仕様を確認し、既存の振込処理と整合する明示的な分岐を追加する。

未登録案内は購入者の口座が存在しない場合だけ通知文へ含める。削除対象ユーザー自身の売上金・ポイント処理で使用する口座と、購入者への返金口座を別の変数名で区別する。

## 対象ファイル

- `/server/src/usecases/admin/users/deleteUser.ts`
    - `deleteUserAdminUseCase`

## 参照すべきファイル

- `/server/src/services/users/query.ts`
    - `getUserHasBankAccount`
    - `getUserHasUriagekinPointBank`
- `/server/src/services/transfer/transfer.ts`
    - `createTransfer`
- `/server/src/types/serviceType/transfer.ts`
- 購入者へのキャンセル返金を作成している他のUseCase

## 実装内容

- 取引中注文ごとに取得した購入者と `buyer.BankAccount` の存在を確認する。
- `createTransfer` の `bank_snapshot` を購入者の口座情報から構築する。
- 購入者の口座がない場合だけ、口座登録を促す文言を通知へ含める。
- 購入者または口座がない場合に空文字の口座スナップショットを作成するか、返金処理を中止するかを既存仕様から確定する。
- 削除対象ユーザーの口座を使用する処理と、購入者口座を使用する処理を明確に分離する。
- 正常系、購入者口座未登録、複数注文のテストを追加する。
- `cd server && npm run lint && npm run typecheck` を実行する。

## 実装時の注意事項

- 管理者によるユーザー削除全体のトランザクション境界を維持する。
- 返金金額、振込予定日、通知種別、注文・配送のキャンセル処理を変更しない。
- 口座情報や個人情報をログへ出力しない。
- 新しいライブラリを追加しない。

---

## 報告

• 修正を完了しました。

- 返金口座を注文ごとの購入者口座から生成
- 購入者が存在しない場合はトランザクションをエラー終了
- 口座未登録時は既存仕様どおり空のスナップショットを保存
- 未登録案内の条件を修正
- 削除対象ユーザーの口座変数を返金処理から排除
- 正常系・口座未登録・複数注文のテストを追加
- 空スナップショットの実態に合わせてBankSnapshot型を調整

変更箇所：

- server/src/usecases/admin/users/deleteUser.ts
- server/src/usecases/admin/users/deleteUserRefund.ts
- server/src/types/bankSnapshot.ts
- server/test/usecases/admin/users/deleteUserRefund.test.ts

確認結果：

- npm run lint: 成功
- npm run typecheck: 成功
- 追加テスト: 3件すべて成功
- git diff --check: 成功
