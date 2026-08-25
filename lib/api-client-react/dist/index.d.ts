export * from "./generated/api";
export * from "./generated/api.schemas";
export { setBaseUrl, setAuthTokenGetter, setAuthTokenSetter, startTokenRefreshLoop, setExtraHeadersGetter, customFetch, } from "./custom-fetch";
export type { AuthTokenGetter, CustomFetchOptions } from "./custom-fetch";
import * as React from "react";
export declare function MiarEditaMenu(): React.DetailedReactHTMLElement<{
    href: string;
    target: string;
    rel: string;
    style: {
        display: "block";
        marginTop: number;
        padding: string;
        borderRadius: number;
        background: string;
        color: "#10161b";
        fontSize: number;
        fontWeight: number;
        textDecoration: string;
        textAlign: "center";
    };
}, HTMLElement> | null;
export { useLogin as useLoginOwner, getGetMeQueryKey as getMeQueryKey, getGetDashboardStatsQueryKey as getDashboardStatsQueryKey, useListTables as useGetTables, useUpdateTable as useUpdateTableStatus, getListTablesQueryKey as getGetTablesQueryKey, useListOrders as useGetOrders, useListStock as useGetStockItems, useAiChat as useSendChatMessage, useGetSettings, useUpdateSettings, useUpdateOrderStatus, useListOrders, useListStock, } from "./generated/api";
export declare function useGetAuthStatus(): import("@tanstack/react-query").UseQueryResult<NoInfer<{
    registered: boolean;
    companyName: string | null;
}>, Error>;
//# sourceMappingURL=index.d.ts.map