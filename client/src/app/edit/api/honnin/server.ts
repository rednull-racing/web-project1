import { apiFetchServer } from "../../../../lib/api/server";
import { GenderOption, User } from "../../types";

type HonninPageResponse = {
    user: User;
    genderAllOptions: GenderOption[];
};

export const fetchHonninPage = async (): Promise<HonninPageResponse> => {
    return apiFetchServer("/user/honnin", {
        cache: "no-store",
    });
};
