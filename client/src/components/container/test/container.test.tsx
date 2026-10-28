import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Container } from "../container";

describe("Container", () => {
    it.each([false, true])("U-N13 header=%sでも子の内容・順序を保持する", (header) => {
        render(<Container header={header}><p>先頭</p><main>本文</main><button>末尾</button></Container>);
        expect(screen.getByText("先頭").compareDocumentPosition(screen.getByRole("main")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole("main").compareDocumentPosition(screen.getByRole("button")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(screen.getByRole("main")).toHaveTextContent("本文");
    });
});
