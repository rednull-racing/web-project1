import { AppError } from "../../errors.js";
import { getMyTransferDetail } from "../../services/transfer/transfer.js";
import { maskAccountNumber } from "../../utils/maskAccountNumber.js";

type Params = {
    transId: number;
    userId: number;
};

// GET /transfer/:id/detail
// summary: 振込申請詳細表示
// page: /transfer/detail/[id]
export const getTransferDetailUseCase = async ({ transId, userId }: Params) => {
    // データ取得
    const transfer = await getMyTransferDetail({ transId, userId });

    if (!transfer) throw new AppError("TRANSFER_NOT_FOUND", 404);

    const plainTransfer = transfer.get({ plain: true });

    return {
        ...plainTransfer,
        bank_snapshot: {
            ...plainTransfer.bank_snapshot,
            account_number: maskAccountNumber({ accountNumber: transfer.bank_snapshot.account_number }),
        },
    };
};
