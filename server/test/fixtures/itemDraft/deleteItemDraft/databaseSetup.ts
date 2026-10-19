import "../../itemEditing/createItemEditingDraft/databaseSetup.js";
import { vi } from "vitest";
export { assertEnvironment } from "../../itemEditing/createItemEditingDraft/databaseSetup.js";

const externalMocks = vi.hoisted(() => ({ send: vi.fn(), remove: vi.fn(), upload: vi.fn() }));
export const external = externalMocks;
vi.mock("../../../../src/usecases/itemDraft/createItemDraft.js", () => ({ createItemDraftUseCase: vi.fn() }));
vi.mock("../../../../src/infra/aws/s3.js", () => ({
    s3: { send: externalMocks.send }, publicS3Domain: "https://media.test", buckets: { public: "test-only" }, region: "test-region",
}));
vi.mock("../../../../src/utils/s3/deleteCmd.js", () => ({ deleteCmdS3: externalMocks.remove }));
vi.mock("../../../../src/utils/s3/videoConvert.js", () => ({ uploadVideoToS3: externalMocks.upload, downloadVideoFromS3: vi.fn() }));
