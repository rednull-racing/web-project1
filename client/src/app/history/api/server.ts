import { apiFetchServer } from "../../../lib/api/server";
import { User } from "../types";

type UserResponse = {
    user: User;
};

export const fetchPointsHistoryPage = async (): Promise<UserResponse> => {
    return apiFetchServer("/user/current-points", {
        cache: "no-store",
    });
};

export const fetchUriagekinHistoryPage = async (): Promise<UserResponse> => {
    return apiFetchServer("/user/current-uriagekin", {
        cache: "no-store",
    });
};
