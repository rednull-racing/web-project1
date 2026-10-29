"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

const OperationContext = createContext<ReturnType<typeof useOperationState> | null>(null);
const useOperationState = () => {
    const active = useRef(false);
    const [busy, setBusy] = useState(false);
    return {
        busy,
        acquire: () => {
            if (active.current) return false;
            active.current = true;
            setBusy(true);
            return true;
        },
        release: () => {
            active.current = false;
            setBusy(false);
        },
    };
};
export const OperationProvider = ({ children }: PropsWithChildren) => {
    const operation = useOperationState();
    return <OperationContext.Provider value={operation}>{children}</OperationContext.Provider>;
};
export const useOperation = () => {
    const local = useOperationState();
    return useContext(OperationContext) ?? local;
};
