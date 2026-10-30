import { apiFetchServer } from "../../../lib/api/server";
import { Option } from "../types";

type ReportResponse = {
    options: Option[];
};

export const fetchCommentReportPage = async (): Promise<ReportResponse> => {
    return apiFetchServer("/comment-report/all-options");
};

export const fetchItemReportPage = async (): Promise<ReportResponse> => {
    return apiFetchServer("/item-report/all-options");
};
