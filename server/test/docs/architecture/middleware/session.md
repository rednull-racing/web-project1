# sessionMiddleware テスト設計

2026-10-23。ユーザー指定のrandomUUID置換と起点Todoを根拠とする。パスはserver/基準。

対象は`src/middleware/session.ts`。UUID生成をNode組込みに移し、既存Cookieの引継ぎとCookie属性・next接続を維持する。session_id形式の新たな検証は追加しない。DB・認証・共通middleware構成は対象外。

| ID | 配置・境界 | 条件と期待結果 |
| --- | --- | --- |
| S01 | `src/middleware/test/session.test.ts`、実middleware・実crypto・部分Request/Response | 既存session_idはそのままreq.sessionIdへ設定、Cookie再発行なし、nextを引数なしで1回 |
| S02 | 同上 | cookies未設定・空辞書・空session_idではUUID v4を発行、同じ値をreqとCookieへ保存。httpOnly/secure=false/lax/30日/pathを維持 |
| S03 | 同上 | 独立要求でUUID重複なし（暗号学的な衝突不在の証明ではない） |
| H01 | `test/integration/usecases/middleware/session/route.test.ts`、実Express/cookie-parser/middleware/crypto | 発行Cookieの属性とUUIDを確認し、次のHTTP要求で同じIDを取得・再発行なし |
| H02/H03 | 同上 | 既存形式のID維持、Cookieなしの別要求へ異なるID |
| R01 | createItem/updateItemの既存route/registration | sessionモックを外し、実middleware barrelがuuid直接依存なしでimportできることと既存HTTP接続を確認 |

実行はserver/から対象ファイル指定の`npm run test:run -- ... --maxWorkers=1`。lint、本番・テスト型検査、通常lint外の変更TS追加検査も行う。実行範囲・結果は[レポート](../../report/middleware/session.md)へ記録。DB操作・migration・本番起動は行わない。
