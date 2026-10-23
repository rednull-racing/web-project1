# item_editing.statusの初期化確認

2026-10-23。パスはserver/基準。ユーザー依頼とmodels/item_editing.tsを根拠とする。
新規・下書き・商品コピーの作成dataはstatus normal。DBはENUM(normal, edit)、NOT NULL、DEFAULT normal。

- P0 N01: src/usecases/itemEditing/test/createItemEditing.test.tsで実usecaseを呼び、service境界をモック。認証ユーザーとstatus normalの完全一致および返却IDを確認。
- P0 N10: createItemEditingCopy/test/usecase.test.tsで元商品のactiveを引き継がずnormalを指定し、元ID・日時・関連IDを含めない。
- 下書き単体の既存N01: makeData期待値にnormalを追加し、作成data全体を検証。
- 下書きDBの既存N01: .env.test由来test_dbの既存ガードとID限定cleanupを使い、新規SELECTでstatus normalを確認。
- service単体の既存S03/S08: 同じdata参照のModelへの引渡しを確認する。DB制約の証明とは区別する。

競合・認証の追加仕様は導入しない。今回の範囲は初期値の追加で、既存の異常系は回帰実行する。実DBへの反映は明示依頼に基づく別操作。[結果](../../report/itemEditing/status.md)。
