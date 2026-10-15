import type BankAccount from "../../../models/bank_account.js";
import { BankSnapshot } from "../../../types/bankSnapshot.js";

type RefundBankAccount = Pick<BankAccount, "bank_name" | "branch" | "account_type" | "account_number" | "meigi">;

const UNREGISTERED_BANK_ACCOUNT_MESSAGE =
    "口座情報が未登録です。至急口座を登録してください。30日以内に登録がない場合、返金できませんのでご注意ください。";

export const createBuyerRefundBankSnapshot = (account?: RefundBankAccount | null): BankSnapshot => ({
    bank_name: account?.bank_name ?? "",
    branch_name: account?.branch ?? "",
    account_type: account?.account_type ?? "",
    account_number: account?.account_number ?? "",
    meigi: account?.meigi ?? "",
});

export const createBuyerRefundNotificationMessage = ({
    itemName,
    buyerHasAccount,
}: {
    itemName: string;
    buyerHasAccount: boolean;
}) =>
    `[重要] 取引中の商品「${itemName}」は利用規約違反により削除され、取引はキャンセル・返金となりました。` +
    `購入費用は全額お客様の口座に返金されます。なお、お振込日は本日から翌々週の金曜日以降となります。ご迷惑をおかけいたしますが、ご対応のほどよろしくお願いします。` +
    (buyerHasAccount ? "" : UNREGISTERED_BANK_ACCOUNT_MESSAGE);
