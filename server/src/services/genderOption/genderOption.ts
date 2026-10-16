import { GenderOption } from "../../models/index.js";

export const getGenderOptionAll = () => {
    return GenderOption.findAll();
};
