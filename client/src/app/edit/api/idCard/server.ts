import { apiFetchServer } from "../../../../lib/api/server";
import { User } from "../../type";

type IdPageResponse = {
    user: User;
};

export const fetchIdPage = async (): Promise<IdPageResponse> => {
    return apiFetchServer("/user/id-card", {
        cache: "no-store",
    });
};
