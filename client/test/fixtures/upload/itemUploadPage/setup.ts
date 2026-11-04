import { vi } from "vitest";
export { API, runtime } from "./baseSetup";
// 実部品の更新収束はfullForm.test.tsxで別途検証。ここでは残る通信契約を分離する。
vi.mock("@/app/upload/genderAge", () => ({ GenderAge: () => null }));
