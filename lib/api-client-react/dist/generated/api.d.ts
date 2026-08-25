import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { ActivityItem, AiChatInput, AiChatMessage, AiInsights, AiReply, Alert, AnalyticsOverview, AuditLog, AuthResult, AuthUser, BackupEntry, BackupResult, Campaign, CampaignInput, CashierMovementInput, CashierReport, CashierSession, CashierSessionClose, CashierSessionOpen, Category, CategoryInput, CategoryUpdate, Courier, CourierGovernance, Customer, DashboardStats, Delivery, DeliveryIncident, DeliveryIncidentInput, DeliveryStatusUpdate, Employee, EmployeeInput, EmployeeToken, EmployeeUpdate, Feedback, FeedbackResponse, FoodAnalysisInput, FoodAnalysisResult, GetAiChatHistoryParams, GetAnalyticsOverviewParams, GetCashierReportParams, GetDashboardActivityParams, GetNutritionHistoryParams, GetProductsAnalyticsParams, GetSalesAnalyticsParams, GetTopSellersParams, HealthStatus, HourData, KitchenView, ListAuditLogsParams, ListCashierSessionsParams, ListCustomersParams, ListDeliveriesParams, ListFeedbackParams, ListMenuItemsParams, ListOrdersParams, ListStockMovementsParams, ListStockParams, LoginInput, MenuItem, MenuItemInput, MenuItemUpdate, NutritionAdvice, NutritionChatInput, NutritionProfile, NutritionProfileUpdate, NutritionRecord, Order, OrderInput, OrderStatusUpdate, ProductsAnalytics, RestaurantSettings, RestaurantSettingsUpdate, SalesAnalytics, StockItem, StockItemInput, StockItemUpdate, StockMovement, StockMovementInput, StockSummary, Table, TableInput, TableSession, TableUpdate, TablesMap, TopSellerItem, WaiterCall } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * @summary Health check
 */
export declare const healthCheck: (options?: RequestInit) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getLoginUrl: () => string;
/**
 * @summary Owner/manager login
 */
export declare const login: (loginInput: LoginInput, options?: RequestInit) => Promise<AuthResult>;
export declare const getLoginMutationOptions: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginInput>;
}, TContext>;
export type LoginMutationResult = NonNullable<Awaited<ReturnType<typeof login>>>;
export type LoginMutationBody = BodyType<LoginInput>;
export type LoginMutationError = ErrorType<void>;
/**
* @summary Owner/manager login
*/
export declare const useLogin: <TError = ErrorType<void>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof login>>, TError, {
        data: BodyType<LoginInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof login>>, TError, {
    data: BodyType<LoginInput>;
}, TContext>;
export declare const getGetMeUrl: () => string;
/**
 * @summary Get current authenticated user
 */
export declare const getMe: (options?: RequestInit) => Promise<AuthUser>;
export declare const getGetMeQueryKey: () => readonly ["/api/auth/me"];
export declare const getGetMeQueryOptions: <TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetMeQueryResult = NonNullable<Awaited<ReturnType<typeof getMe>>>;
export type GetMeQueryError = ErrorType<unknown>;
/**
 * @summary Get current authenticated user
 */
export declare function useGetMe<TData = Awaited<ReturnType<typeof getMe>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getMe>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardStatsUrl: () => string;
/**
 * @summary Main dashboard KPIs and summary
 */
export declare const getDashboardStats: (options?: RequestInit) => Promise<DashboardStats>;
export declare const getGetDashboardStatsQueryKey: () => readonly ["/api/dashboard/stats"];
export declare const getGetDashboardStatsQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardStatsQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardStats>>>;
export type GetDashboardStatsQueryError = ErrorType<unknown>;
/**
 * @summary Main dashboard KPIs and summary
 */
export declare function useGetDashboardStats<TData = Awaited<ReturnType<typeof getDashboardStats>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardStats>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardActivityUrl: (params?: GetDashboardActivityParams) => string;
/**
 * @summary Recent activity feed
 */
export declare const getDashboardActivity: (params?: GetDashboardActivityParams, options?: RequestInit) => Promise<ActivityItem[]>;
export declare const getGetDashboardActivityQueryKey: (params?: GetDashboardActivityParams) => readonly ["/api/dashboard/activity", ...GetDashboardActivityParams[]];
export declare const getGetDashboardActivityQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardActivity>>, TError = ErrorType<unknown>>(params?: GetDashboardActivityParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardActivity>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardActivityQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardActivity>>>;
export type GetDashboardActivityQueryError = ErrorType<unknown>;
/**
 * @summary Recent activity feed
 */
export declare function useGetDashboardActivity<TData = Awaited<ReturnType<typeof getDashboardActivity>>, TError = ErrorType<unknown>>(params?: GetDashboardActivityParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardActivity>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardAlertsUrl: () => string;
/**
 * @summary Active alerts (low stock, expiry, waiter calls, etc.)
 */
export declare const getDashboardAlerts: (options?: RequestInit) => Promise<Alert[]>;
export declare const getGetDashboardAlertsQueryKey: () => readonly ["/api/dashboard/alerts"];
export declare const getGetDashboardAlertsQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardAlerts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardAlerts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardAlerts>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardAlertsQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardAlerts>>>;
export type GetDashboardAlertsQueryError = ErrorType<unknown>;
/**
 * @summary Active alerts (low stock, expiry, waiter calls, etc.)
 */
export declare function useGetDashboardAlerts<TData = Awaited<ReturnType<typeof getDashboardAlerts>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardAlerts>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListOrdersUrl: (params?: ListOrdersParams) => string;
/**
 * @summary List orders
 */
export declare const listOrders: (params?: ListOrdersParams, options?: RequestInit) => Promise<Order[]>;
export declare const getListOrdersQueryKey: (params?: ListOrdersParams) => readonly ["/api/orders", ...ListOrdersParams[]];
export declare const getListOrdersQueryOptions: <TData = Awaited<ReturnType<typeof listOrders>>, TError = ErrorType<unknown>>(params?: ListOrdersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListOrdersQueryResult = NonNullable<Awaited<ReturnType<typeof listOrders>>>;
export type ListOrdersQueryError = ErrorType<unknown>;
/**
 * @summary List orders
 */
export declare function useListOrders<TData = Awaited<ReturnType<typeof listOrders>>, TError = ErrorType<unknown>>(params?: ListOrdersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateOrderUrl: () => string;
/**
 * @summary Create order
 */
export declare const createOrder: (orderInput: OrderInput, options?: RequestInit) => Promise<Order>;
export declare const getCreateOrderMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
        data: BodyType<OrderInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
    data: BodyType<OrderInput>;
}, TContext>;
export type CreateOrderMutationResult = NonNullable<Awaited<ReturnType<typeof createOrder>>>;
export type CreateOrderMutationBody = BodyType<OrderInput>;
export type CreateOrderMutationError = ErrorType<unknown>;
/**
* @summary Create order
*/
export declare const useCreateOrder: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createOrder>>, TError, {
        data: BodyType<OrderInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createOrder>>, TError, {
    data: BodyType<OrderInput>;
}, TContext>;
export declare const getGetOrderUrl: (id: number) => string;
/**
 * @summary Get order by ID
 */
export declare const getOrder: (id: number, options?: RequestInit) => Promise<Order>;
export declare const getGetOrderQueryKey: (id: number) => readonly [`/api/orders/${number}`];
export declare const getGetOrderQueryOptions: <TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetOrderQueryResult = NonNullable<Awaited<ReturnType<typeof getOrder>>>;
export type GetOrderQueryError = ErrorType<unknown>;
/**
 * @summary Get order by ID
 */
export declare function useGetOrder<TData = Awaited<ReturnType<typeof getOrder>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getOrder>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateOrderStatusUrl: (id: number) => string;
/**
 * @summary Update order status
 */
export declare const updateOrderStatus: (id: number, orderStatusUpdate: OrderStatusUpdate, options?: RequestInit) => Promise<Order>;
export declare const getUpdateOrderStatusMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
        id: number;
        data: BodyType<OrderStatusUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
    id: number;
    data: BodyType<OrderStatusUpdate>;
}, TContext>;
export type UpdateOrderStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateOrderStatus>>>;
export type UpdateOrderStatusMutationBody = BodyType<OrderStatusUpdate>;
export type UpdateOrderStatusMutationError = ErrorType<unknown>;
/**
* @summary Update order status
*/
export declare const useUpdateOrderStatus: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
        id: number;
        data: BodyType<OrderStatusUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateOrderStatus>>, TError, {
    id: number;
    data: BodyType<OrderStatusUpdate>;
}, TContext>;
export declare const getGetKitchenOrdersUrl: () => string;
/**
 * @summary Kitchen view — pending and preparing orders
 */
export declare const getKitchenOrders: (options?: RequestInit) => Promise<KitchenView>;
export declare const getGetKitchenOrdersQueryKey: () => readonly ["/api/orders/kitchen"];
export declare const getGetKitchenOrdersQueryOptions: <TData = Awaited<ReturnType<typeof getKitchenOrders>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getKitchenOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getKitchenOrders>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetKitchenOrdersQueryResult = NonNullable<Awaited<ReturnType<typeof getKitchenOrders>>>;
export type GetKitchenOrdersQueryError = ErrorType<unknown>;
/**
 * @summary Kitchen view — pending and preparing orders
 */
export declare function useGetKitchenOrders<TData = Awaited<ReturnType<typeof getKitchenOrders>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getKitchenOrders>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListTablesUrl: () => string;
/**
 * @summary List all tables with status
 */
export declare const listTables: (options?: RequestInit) => Promise<Table[]>;
export declare const getListTablesQueryKey: () => readonly ["/api/tables"];
export declare const getListTablesQueryOptions: <TData = Awaited<ReturnType<typeof listTables>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTables>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listTables>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListTablesQueryResult = NonNullable<Awaited<ReturnType<typeof listTables>>>;
export type ListTablesQueryError = ErrorType<unknown>;
/**
 * @summary List all tables with status
 */
export declare function useListTables<TData = Awaited<ReturnType<typeof listTables>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listTables>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateTableUrl: () => string;
/**
 * @summary Create table
 */
export declare const createTable: (tableInput: TableInput, options?: RequestInit) => Promise<Table>;
export declare const getCreateTableMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTable>>, TError, {
        data: BodyType<TableInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createTable>>, TError, {
    data: BodyType<TableInput>;
}, TContext>;
export type CreateTableMutationResult = NonNullable<Awaited<ReturnType<typeof createTable>>>;
export type CreateTableMutationBody = BodyType<TableInput>;
export type CreateTableMutationError = ErrorType<unknown>;
/**
* @summary Create table
*/
export declare const useCreateTable: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createTable>>, TError, {
        data: BodyType<TableInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createTable>>, TError, {
    data: BodyType<TableInput>;
}, TContext>;
export declare const getUpdateTableUrl: (id: number) => string;
/**
 * @summary Update table status or info
 */
export declare const updateTable: (id: number, tableUpdate: TableUpdate, options?: RequestInit) => Promise<Table>;
export declare const getUpdateTableMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTable>>, TError, {
        id: number;
        data: BodyType<TableUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateTable>>, TError, {
    id: number;
    data: BodyType<TableUpdate>;
}, TContext>;
export type UpdateTableMutationResult = NonNullable<Awaited<ReturnType<typeof updateTable>>>;
export type UpdateTableMutationBody = BodyType<TableUpdate>;
export type UpdateTableMutationError = ErrorType<unknown>;
/**
* @summary Update table status or info
*/
export declare const useUpdateTable: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateTable>>, TError, {
        id: number;
        data: BodyType<TableUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateTable>>, TError, {
    id: number;
    data: BodyType<TableUpdate>;
}, TContext>;
export declare const getGetTableSessionUrl: (id: number) => string;
/**
 * @summary Get active session for a table
 */
export declare const getTableSession: (id: number, options?: RequestInit) => Promise<TableSession>;
export declare const getGetTableSessionQueryKey: (id: number) => readonly [`/api/tables/${number}/session`];
export declare const getGetTableSessionQueryOptions: <TData = Awaited<ReturnType<typeof getTableSession>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTableSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTableSession>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTableSessionQueryResult = NonNullable<Awaited<ReturnType<typeof getTableSession>>>;
export type GetTableSessionQueryError = ErrorType<unknown>;
/**
 * @summary Get active session for a table
 */
export declare function useGetTableSession<TData = Awaited<ReturnType<typeof getTableSession>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTableSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetTablesMapUrl: () => string;
/**
 * @summary Table map with occupancy stats
 */
export declare const getTablesMap: (options?: RequestInit) => Promise<TablesMap>;
export declare const getGetTablesMapQueryKey: () => readonly ["/api/tables/map"];
export declare const getGetTablesMapQueryOptions: <TData = Awaited<ReturnType<typeof getTablesMap>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTablesMap>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTablesMap>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTablesMapQueryResult = NonNullable<Awaited<ReturnType<typeof getTablesMap>>>;
export type GetTablesMapQueryError = ErrorType<unknown>;
/**
 * @summary Table map with occupancy stats
 */
export declare function useGetTablesMap<TData = Awaited<ReturnType<typeof getTablesMap>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTablesMap>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListWaiterCallsUrl: () => string;
/**
 * @summary List active waiter calls
 */
export declare const listWaiterCalls: (options?: RequestInit) => Promise<WaiterCall[]>;
export declare const getListWaiterCallsQueryKey: () => readonly ["/api/waiter-calls"];
export declare const getListWaiterCallsQueryOptions: <TData = Awaited<ReturnType<typeof listWaiterCalls>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listWaiterCalls>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listWaiterCalls>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListWaiterCallsQueryResult = NonNullable<Awaited<ReturnType<typeof listWaiterCalls>>>;
export type ListWaiterCallsQueryError = ErrorType<unknown>;
/**
 * @summary List active waiter calls
 */
export declare function useListWaiterCalls<TData = Awaited<ReturnType<typeof listWaiterCalls>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listWaiterCalls>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getClaimWaiterCallUrl: (id: number) => string;
/**
 * @summary Claim/resolve a waiter call
 */
export declare const claimWaiterCall: (id: number, options?: RequestInit) => Promise<void>;
export declare const getClaimWaiterCallMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof claimWaiterCall>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof claimWaiterCall>>, TError, {
    id: number;
}, TContext>;
export type ClaimWaiterCallMutationResult = NonNullable<Awaited<ReturnType<typeof claimWaiterCall>>>;
export type ClaimWaiterCallMutationError = ErrorType<unknown>;
/**
* @summary Claim/resolve a waiter call
*/
export declare const useClaimWaiterCall: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof claimWaiterCall>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof claimWaiterCall>>, TError, {
    id: number;
}, TContext>;
export declare const getListCategoriesUrl: () => string;
/**
 * @summary List menu categories
 */
export declare const listCategories: (options?: RequestInit) => Promise<Category[]>;
export declare const getListCategoriesQueryKey: () => readonly ["/api/menu/categories"];
export declare const getListCategoriesQueryOptions: <TData = Awaited<ReturnType<typeof listCategories>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCategories>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCategories>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCategoriesQueryResult = NonNullable<Awaited<ReturnType<typeof listCategories>>>;
export type ListCategoriesQueryError = ErrorType<unknown>;
/**
 * @summary List menu categories
 */
export declare function useListCategories<TData = Awaited<ReturnType<typeof listCategories>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCategories>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCategoryUrl: () => string;
/**
 * @summary Create category
 */
export declare const createCategory: (categoryInput: CategoryInput, options?: RequestInit) => Promise<Category>;
export declare const getCreateCategoryMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCategory>>, TError, {
        data: BodyType<CategoryInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCategory>>, TError, {
    data: BodyType<CategoryInput>;
}, TContext>;
export type CreateCategoryMutationResult = NonNullable<Awaited<ReturnType<typeof createCategory>>>;
export type CreateCategoryMutationBody = BodyType<CategoryInput>;
export type CreateCategoryMutationError = ErrorType<unknown>;
/**
* @summary Create category
*/
export declare const useCreateCategory: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCategory>>, TError, {
        data: BodyType<CategoryInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCategory>>, TError, {
    data: BodyType<CategoryInput>;
}, TContext>;
export declare const getUpdateCategoryUrl: (id: number) => string;
/**
 * @summary Update category
 */
export declare const updateCategory: (id: number, categoryUpdate: CategoryUpdate, options?: RequestInit) => Promise<Category>;
export declare const getUpdateCategoryMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCategory>>, TError, {
        id: number;
        data: BodyType<CategoryUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateCategory>>, TError, {
    id: number;
    data: BodyType<CategoryUpdate>;
}, TContext>;
export type UpdateCategoryMutationResult = NonNullable<Awaited<ReturnType<typeof updateCategory>>>;
export type UpdateCategoryMutationBody = BodyType<CategoryUpdate>;
export type UpdateCategoryMutationError = ErrorType<unknown>;
/**
* @summary Update category
*/
export declare const useUpdateCategory: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateCategory>>, TError, {
        id: number;
        data: BodyType<CategoryUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateCategory>>, TError, {
    id: number;
    data: BodyType<CategoryUpdate>;
}, TContext>;
export declare const getDeleteCategoryUrl: (id: number) => string;
/**
 * @summary Delete category
 */
export declare const deleteCategory: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteCategoryMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCategory>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCategory>>, TError, {
    id: number;
}, TContext>;
export type DeleteCategoryMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCategory>>>;
export type DeleteCategoryMutationError = ErrorType<unknown>;
/**
* @summary Delete category
*/
export declare const useDeleteCategory: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCategory>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCategory>>, TError, {
    id: number;
}, TContext>;
export declare const getListMenuItemsUrl: (params?: ListMenuItemsParams) => string;
/**
 * @summary List menu items
 */
export declare const listMenuItems: (params?: ListMenuItemsParams, options?: RequestInit) => Promise<MenuItem[]>;
export declare const getListMenuItemsQueryKey: (params?: ListMenuItemsParams) => readonly ["/api/menu/items", ...ListMenuItemsParams[]];
export declare const getListMenuItemsQueryOptions: <TData = Awaited<ReturnType<typeof listMenuItems>>, TError = ErrorType<unknown>>(params?: ListMenuItemsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMenuItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listMenuItems>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListMenuItemsQueryResult = NonNullable<Awaited<ReturnType<typeof listMenuItems>>>;
export type ListMenuItemsQueryError = ErrorType<unknown>;
/**
 * @summary List menu items
 */
export declare function useListMenuItems<TData = Awaited<ReturnType<typeof listMenuItems>>, TError = ErrorType<unknown>>(params?: ListMenuItemsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listMenuItems>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateMenuItemUrl: () => string;
/**
 * @summary Create menu item
 */
export declare const createMenuItem: (menuItemInput: MenuItemInput, options?: RequestInit) => Promise<MenuItem>;
export declare const getCreateMenuItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMenuItem>>, TError, {
        data: BodyType<MenuItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createMenuItem>>, TError, {
    data: BodyType<MenuItemInput>;
}, TContext>;
export type CreateMenuItemMutationResult = NonNullable<Awaited<ReturnType<typeof createMenuItem>>>;
export type CreateMenuItemMutationBody = BodyType<MenuItemInput>;
export type CreateMenuItemMutationError = ErrorType<unknown>;
/**
* @summary Create menu item
*/
export declare const useCreateMenuItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createMenuItem>>, TError, {
        data: BodyType<MenuItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createMenuItem>>, TError, {
    data: BodyType<MenuItemInput>;
}, TContext>;
export declare const getUpdateMenuItemUrl: (id: number) => string;
/**
 * @summary Update menu item
 */
export declare const updateMenuItem: (id: number, menuItemUpdate: MenuItemUpdate, options?: RequestInit) => Promise<MenuItem>;
export declare const getUpdateMenuItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMenuItem>>, TError, {
        id: number;
        data: BodyType<MenuItemUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateMenuItem>>, TError, {
    id: number;
    data: BodyType<MenuItemUpdate>;
}, TContext>;
export type UpdateMenuItemMutationResult = NonNullable<Awaited<ReturnType<typeof updateMenuItem>>>;
export type UpdateMenuItemMutationBody = BodyType<MenuItemUpdate>;
export type UpdateMenuItemMutationError = ErrorType<unknown>;
/**
* @summary Update menu item
*/
export declare const useUpdateMenuItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateMenuItem>>, TError, {
        id: number;
        data: BodyType<MenuItemUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateMenuItem>>, TError, {
    id: number;
    data: BodyType<MenuItemUpdate>;
}, TContext>;
export declare const getDeleteMenuItemUrl: (id: number) => string;
/**
 * @summary Delete menu item
 */
export declare const deleteMenuItem: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteMenuItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteMenuItem>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteMenuItem>>, TError, {
    id: number;
}, TContext>;
export type DeleteMenuItemMutationResult = NonNullable<Awaited<ReturnType<typeof deleteMenuItem>>>;
export type DeleteMenuItemMutationError = ErrorType<unknown>;
/**
* @summary Delete menu item
*/
export declare const useDeleteMenuItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteMenuItem>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteMenuItem>>, TError, {
    id: number;
}, TContext>;
export declare const getGetTopSellersUrl: (params?: GetTopSellersParams) => string;
/**
 * @summary Top selling menu items
 */
export declare const getTopSellers: (params?: GetTopSellersParams, options?: RequestInit) => Promise<TopSellerItem[]>;
export declare const getGetTopSellersQueryKey: (params?: GetTopSellersParams) => readonly ["/api/menu/top-sellers", ...GetTopSellersParams[]];
export declare const getGetTopSellersQueryOptions: <TData = Awaited<ReturnType<typeof getTopSellers>>, TError = ErrorType<unknown>>(params?: GetTopSellersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTopSellers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getTopSellers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetTopSellersQueryResult = NonNullable<Awaited<ReturnType<typeof getTopSellers>>>;
export type GetTopSellersQueryError = ErrorType<unknown>;
/**
 * @summary Top selling menu items
 */
export declare function useGetTopSellers<TData = Awaited<ReturnType<typeof getTopSellers>>, TError = ErrorType<unknown>>(params?: GetTopSellersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getTopSellers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListStockUrl: (params?: ListStockParams) => string;
/**
 * @summary List stock items
 */
export declare const listStock: (params?: ListStockParams, options?: RequestInit) => Promise<StockItem[]>;
export declare const getListStockQueryKey: (params?: ListStockParams) => readonly ["/api/stock", ...ListStockParams[]];
export declare const getListStockQueryOptions: <TData = Awaited<ReturnType<typeof listStock>>, TError = ErrorType<unknown>>(params?: ListStockParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStock>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listStock>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListStockQueryResult = NonNullable<Awaited<ReturnType<typeof listStock>>>;
export type ListStockQueryError = ErrorType<unknown>;
/**
 * @summary List stock items
 */
export declare function useListStock<TData = Awaited<ReturnType<typeof listStock>>, TError = ErrorType<unknown>>(params?: ListStockParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStock>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateStockItemUrl: () => string;
/**
 * @summary Create stock item
 */
export declare const createStockItem: (stockItemInput: StockItemInput, options?: RequestInit) => Promise<StockItem>;
export declare const getCreateStockItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStockItem>>, TError, {
        data: BodyType<StockItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createStockItem>>, TError, {
    data: BodyType<StockItemInput>;
}, TContext>;
export type CreateStockItemMutationResult = NonNullable<Awaited<ReturnType<typeof createStockItem>>>;
export type CreateStockItemMutationBody = BodyType<StockItemInput>;
export type CreateStockItemMutationError = ErrorType<unknown>;
/**
* @summary Create stock item
*/
export declare const useCreateStockItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStockItem>>, TError, {
        data: BodyType<StockItemInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createStockItem>>, TError, {
    data: BodyType<StockItemInput>;
}, TContext>;
export declare const getUpdateStockItemUrl: (id: number) => string;
/**
 * @summary Update stock item
 */
export declare const updateStockItem: (id: number, stockItemUpdate: StockItemUpdate, options?: RequestInit) => Promise<StockItem>;
export declare const getUpdateStockItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateStockItem>>, TError, {
        id: number;
        data: BodyType<StockItemUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateStockItem>>, TError, {
    id: number;
    data: BodyType<StockItemUpdate>;
}, TContext>;
export type UpdateStockItemMutationResult = NonNullable<Awaited<ReturnType<typeof updateStockItem>>>;
export type UpdateStockItemMutationBody = BodyType<StockItemUpdate>;
export type UpdateStockItemMutationError = ErrorType<unknown>;
/**
* @summary Update stock item
*/
export declare const useUpdateStockItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateStockItem>>, TError, {
        id: number;
        data: BodyType<StockItemUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateStockItem>>, TError, {
    id: number;
    data: BodyType<StockItemUpdate>;
}, TContext>;
export declare const getDeleteStockItemUrl: (id: number) => string;
/**
 * @summary Delete stock item
 */
export declare const deleteStockItem: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteStockItemMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteStockItem>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteStockItem>>, TError, {
    id: number;
}, TContext>;
export type DeleteStockItemMutationResult = NonNullable<Awaited<ReturnType<typeof deleteStockItem>>>;
export type DeleteStockItemMutationError = ErrorType<unknown>;
/**
* @summary Delete stock item
*/
export declare const useDeleteStockItem: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteStockItem>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteStockItem>>, TError, {
    id: number;
}, TContext>;
export declare const getGetStockSummaryUrl: () => string;
/**
 * @summary Stock summary — low stock count, near expiry count, total value
 */
export declare const getStockSummary: (options?: RequestInit) => Promise<StockSummary>;
export declare const getGetStockSummaryQueryKey: () => readonly ["/api/stock/summary"];
export declare const getGetStockSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getStockSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStockSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStockSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStockSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getStockSummary>>>;
export type GetStockSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Stock summary — low stock count, near expiry count, total value
 */
export declare function useGetStockSummary<TData = Awaited<ReturnType<typeof getStockSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStockSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListStockMovementsUrl: (params?: ListStockMovementsParams) => string;
/**
 * @summary Stock movement history
 */
export declare const listStockMovements: (params?: ListStockMovementsParams, options?: RequestInit) => Promise<StockMovement[]>;
export declare const getListStockMovementsQueryKey: (params?: ListStockMovementsParams) => readonly ["/api/stock/movements", ...ListStockMovementsParams[]];
export declare const getListStockMovementsQueryOptions: <TData = Awaited<ReturnType<typeof listStockMovements>>, TError = ErrorType<unknown>>(params?: ListStockMovementsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStockMovements>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listStockMovements>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListStockMovementsQueryResult = NonNullable<Awaited<ReturnType<typeof listStockMovements>>>;
export type ListStockMovementsQueryError = ErrorType<unknown>;
/**
 * @summary Stock movement history
 */
export declare function useListStockMovements<TData = Awaited<ReturnType<typeof listStockMovements>>, TError = ErrorType<unknown>>(params?: ListStockMovementsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listStockMovements>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateStockMovementUrl: () => string;
/**
 * @summary Record stock movement (entry or exit)
 */
export declare const createStockMovement: (stockMovementInput: StockMovementInput, options?: RequestInit) => Promise<StockMovement>;
export declare const getCreateStockMovementMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStockMovement>>, TError, {
        data: BodyType<StockMovementInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createStockMovement>>, TError, {
    data: BodyType<StockMovementInput>;
}, TContext>;
export type CreateStockMovementMutationResult = NonNullable<Awaited<ReturnType<typeof createStockMovement>>>;
export type CreateStockMovementMutationBody = BodyType<StockMovementInput>;
export type CreateStockMovementMutationError = ErrorType<unknown>;
/**
* @summary Record stock movement (entry or exit)
*/
export declare const useCreateStockMovement: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createStockMovement>>, TError, {
        data: BodyType<StockMovementInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createStockMovement>>, TError, {
    data: BodyType<StockMovementInput>;
}, TContext>;
export declare const getGetCurrentCashierSessionUrl: () => string;
/**
 * @summary Get current open cashier session
 */
export declare const getCurrentCashierSession: (options?: RequestInit) => Promise<CashierSession>;
export declare const getGetCurrentCashierSessionQueryKey: () => readonly ["/api/cashier/session/current"];
export declare const getGetCurrentCashierSessionQueryOptions: <TData = Awaited<ReturnType<typeof getCurrentCashierSession>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentCashierSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCurrentCashierSession>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCurrentCashierSessionQueryResult = NonNullable<Awaited<ReturnType<typeof getCurrentCashierSession>>>;
export type GetCurrentCashierSessionQueryError = ErrorType<unknown>;
/**
 * @summary Get current open cashier session
 */
export declare function useGetCurrentCashierSession<TData = Awaited<ReturnType<typeof getCurrentCashierSession>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCurrentCashierSession>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getOpenCashierSessionUrl: () => string;
/**
 * @summary Open cashier session (start of shift)
 */
export declare const openCashierSession: (cashierSessionOpen: CashierSessionOpen, options?: RequestInit) => Promise<CashierSession>;
export declare const getOpenCashierSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof openCashierSession>>, TError, {
        data: BodyType<CashierSessionOpen>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof openCashierSession>>, TError, {
    data: BodyType<CashierSessionOpen>;
}, TContext>;
export type OpenCashierSessionMutationResult = NonNullable<Awaited<ReturnType<typeof openCashierSession>>>;
export type OpenCashierSessionMutationBody = BodyType<CashierSessionOpen>;
export type OpenCashierSessionMutationError = ErrorType<unknown>;
/**
* @summary Open cashier session (start of shift)
*/
export declare const useOpenCashierSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof openCashierSession>>, TError, {
        data: BodyType<CashierSessionOpen>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof openCashierSession>>, TError, {
    data: BodyType<CashierSessionOpen>;
}, TContext>;
export declare const getCloseCashierSessionUrl: (id: number) => string;
/**
 * @summary Close cashier session (end of shift)
 */
export declare const closeCashierSession: (id: number, cashierSessionClose: CashierSessionClose, options?: RequestInit) => Promise<CashierSession>;
export declare const getCloseCashierSessionMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof closeCashierSession>>, TError, {
        id: number;
        data: BodyType<CashierSessionClose>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof closeCashierSession>>, TError, {
    id: number;
    data: BodyType<CashierSessionClose>;
}, TContext>;
export type CloseCashierSessionMutationResult = NonNullable<Awaited<ReturnType<typeof closeCashierSession>>>;
export type CloseCashierSessionMutationBody = BodyType<CashierSessionClose>;
export type CloseCashierSessionMutationError = ErrorType<unknown>;
/**
* @summary Close cashier session (end of shift)
*/
export declare const useCloseCashierSession: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof closeCashierSession>>, TError, {
        id: number;
        data: BodyType<CashierSessionClose>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof closeCashierSession>>, TError, {
    id: number;
    data: BodyType<CashierSessionClose>;
}, TContext>;
export declare const getAddCashierMovementUrl: (id: number) => string;
/**
 * @summary Add cashier movement (sangria, reforço, sale)
 */
export declare const addCashierMovement: (id: number, cashierMovementInput: CashierMovementInput, options?: RequestInit) => Promise<CashierSession>;
export declare const getAddCashierMovementMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addCashierMovement>>, TError, {
        id: number;
        data: BodyType<CashierMovementInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof addCashierMovement>>, TError, {
    id: number;
    data: BodyType<CashierMovementInput>;
}, TContext>;
export type AddCashierMovementMutationResult = NonNullable<Awaited<ReturnType<typeof addCashierMovement>>>;
export type AddCashierMovementMutationBody = BodyType<CashierMovementInput>;
export type AddCashierMovementMutationError = ErrorType<unknown>;
/**
* @summary Add cashier movement (sangria, reforço, sale)
*/
export declare const useAddCashierMovement: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof addCashierMovement>>, TError, {
        id: number;
        data: BodyType<CashierMovementInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof addCashierMovement>>, TError, {
    id: number;
    data: BodyType<CashierMovementInput>;
}, TContext>;
export declare const getListCashierSessionsUrl: (params?: ListCashierSessionsParams) => string;
/**
 * @summary List cashier sessions history
 */
export declare const listCashierSessions: (params?: ListCashierSessionsParams, options?: RequestInit) => Promise<CashierSession[]>;
export declare const getListCashierSessionsQueryKey: (params?: ListCashierSessionsParams) => readonly ["/api/cashier/sessions", ...ListCashierSessionsParams[]];
export declare const getListCashierSessionsQueryOptions: <TData = Awaited<ReturnType<typeof listCashierSessions>>, TError = ErrorType<unknown>>(params?: ListCashierSessionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCashierSessions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCashierSessions>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCashierSessionsQueryResult = NonNullable<Awaited<ReturnType<typeof listCashierSessions>>>;
export type ListCashierSessionsQueryError = ErrorType<unknown>;
/**
 * @summary List cashier sessions history
 */
export declare function useListCashierSessions<TData = Awaited<ReturnType<typeof listCashierSessions>>, TError = ErrorType<unknown>>(params?: ListCashierSessionsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCashierSessions>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCashierReportUrl: (params?: GetCashierReportParams) => string;
/**
 * @summary Financial report for a date range
 */
export declare const getCashierReport: (params?: GetCashierReportParams, options?: RequestInit) => Promise<CashierReport>;
export declare const getGetCashierReportQueryKey: (params?: GetCashierReportParams) => readonly ["/api/cashier/report", ...GetCashierReportParams[]];
export declare const getGetCashierReportQueryOptions: <TData = Awaited<ReturnType<typeof getCashierReport>>, TError = ErrorType<unknown>>(params?: GetCashierReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCashierReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCashierReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCashierReportQueryResult = NonNullable<Awaited<ReturnType<typeof getCashierReport>>>;
export type GetCashierReportQueryError = ErrorType<unknown>;
/**
 * @summary Financial report for a date range
 */
export declare function useGetCashierReport<TData = Awaited<ReturnType<typeof getCashierReport>>, TError = ErrorType<unknown>>(params?: GetCashierReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCashierReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListDeliveriesUrl: (params?: ListDeliveriesParams) => string;
/**
 * @summary List delivery orders
 */
export declare const listDeliveries: (params?: ListDeliveriesParams, options?: RequestInit) => Promise<Delivery[]>;
export declare const getListDeliveriesQueryKey: (params?: ListDeliveriesParams) => readonly ["/api/deliveries", ...ListDeliveriesParams[]];
export declare const getListDeliveriesQueryOptions: <TData = Awaited<ReturnType<typeof listDeliveries>>, TError = ErrorType<unknown>>(params?: ListDeliveriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDeliveries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listDeliveries>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListDeliveriesQueryResult = NonNullable<Awaited<ReturnType<typeof listDeliveries>>>;
export type ListDeliveriesQueryError = ErrorType<unknown>;
/**
 * @summary List delivery orders
 */
export declare function useListDeliveries<TData = Awaited<ReturnType<typeof listDeliveries>>, TError = ErrorType<unknown>>(params?: ListDeliveriesParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listDeliveries>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDeliveryUrl: (id: number) => string;
/**
 * @summary Get delivery details
 */
export declare const getDelivery: (id: number, options?: RequestInit) => Promise<Delivery>;
export declare const getGetDeliveryQueryKey: (id: number) => readonly [`/api/deliveries/${number}`];
export declare const getGetDeliveryQueryOptions: <TData = Awaited<ReturnType<typeof getDelivery>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDelivery>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDelivery>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDeliveryQueryResult = NonNullable<Awaited<ReturnType<typeof getDelivery>>>;
export type GetDeliveryQueryError = ErrorType<unknown>;
/**
 * @summary Get delivery details
 */
export declare function useGetDelivery<TData = Awaited<ReturnType<typeof getDelivery>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDelivery>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateDeliveryStatusUrl: (id: number) => string;
/**
 * @summary Update delivery status
 */
export declare const updateDeliveryStatus: (id: number, deliveryStatusUpdate: DeliveryStatusUpdate, options?: RequestInit) => Promise<Delivery>;
export declare const getUpdateDeliveryStatusMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDeliveryStatus>>, TError, {
        id: number;
        data: BodyType<DeliveryStatusUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateDeliveryStatus>>, TError, {
    id: number;
    data: BodyType<DeliveryStatusUpdate>;
}, TContext>;
export type UpdateDeliveryStatusMutationResult = NonNullable<Awaited<ReturnType<typeof updateDeliveryStatus>>>;
export type UpdateDeliveryStatusMutationBody = BodyType<DeliveryStatusUpdate>;
export type UpdateDeliveryStatusMutationError = ErrorType<unknown>;
/**
* @summary Update delivery status
*/
export declare const useUpdateDeliveryStatus: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateDeliveryStatus>>, TError, {
        id: number;
        data: BodyType<DeliveryStatusUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateDeliveryStatus>>, TError, {
    id: number;
    data: BodyType<DeliveryStatusUpdate>;
}, TContext>;
export declare const getCreateDeliveryIncidentUrl: (id: number) => string;
/**
 * @summary Register delivery incident
 */
export declare const createDeliveryIncident: (id: number, deliveryIncidentInput: DeliveryIncidentInput, options?: RequestInit) => Promise<DeliveryIncident>;
export declare const getCreateDeliveryIncidentMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDeliveryIncident>>, TError, {
        id: number;
        data: BodyType<DeliveryIncidentInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createDeliveryIncident>>, TError, {
    id: number;
    data: BodyType<DeliveryIncidentInput>;
}, TContext>;
export type CreateDeliveryIncidentMutationResult = NonNullable<Awaited<ReturnType<typeof createDeliveryIncident>>>;
export type CreateDeliveryIncidentMutationBody = BodyType<DeliveryIncidentInput>;
export type CreateDeliveryIncidentMutationError = ErrorType<unknown>;
/**
* @summary Register delivery incident
*/
export declare const useCreateDeliveryIncident: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createDeliveryIncident>>, TError, {
        id: number;
        data: BodyType<DeliveryIncidentInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createDeliveryIncident>>, TError, {
    id: number;
    data: BodyType<DeliveryIncidentInput>;
}, TContext>;
export declare const getListCouriersUrl: () => string;
/**
 * @summary List couriers with governance status
 */
export declare const listCouriers: (options?: RequestInit) => Promise<Courier[]>;
export declare const getListCouriersQueryKey: () => readonly ["/api/delivery/couriers"];
export declare const getListCouriersQueryOptions: <TData = Awaited<ReturnType<typeof listCouriers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCouriers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCouriers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCouriersQueryResult = NonNullable<Awaited<ReturnType<typeof listCouriers>>>;
export type ListCouriersQueryError = ErrorType<unknown>;
/**
 * @summary List couriers with governance status
 */
export declare function useListCouriers<TData = Awaited<ReturnType<typeof listCouriers>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCouriers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCourierGovernanceUrl: (id: number) => string;
/**
 * @summary Get courier governance history (incidents, warnings, suspensions)
 */
export declare const getCourierGovernance: (id: number, options?: RequestInit) => Promise<CourierGovernance>;
export declare const getGetCourierGovernanceQueryKey: (id: number) => readonly [`/api/delivery/couriers/${number}/governance`];
export declare const getGetCourierGovernanceQueryOptions: <TData = Awaited<ReturnType<typeof getCourierGovernance>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCourierGovernance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCourierGovernance>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCourierGovernanceQueryResult = NonNullable<Awaited<ReturnType<typeof getCourierGovernance>>>;
export type GetCourierGovernanceQueryError = ErrorType<unknown>;
/**
 * @summary Get courier governance history (incidents, warnings, suspensions)
 */
export declare function useGetCourierGovernance<TData = Awaited<ReturnType<typeof getCourierGovernance>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCourierGovernance>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListEmployeesUrl: () => string;
/**
 * @summary List employees
 */
export declare const listEmployees: (options?: RequestInit) => Promise<Employee[]>;
export declare const getListEmployeesQueryKey: () => readonly ["/api/employees"];
export declare const getListEmployeesQueryOptions: <TData = Awaited<ReturnType<typeof listEmployees>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEmployees>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listEmployees>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListEmployeesQueryResult = NonNullable<Awaited<ReturnType<typeof listEmployees>>>;
export type ListEmployeesQueryError = ErrorType<unknown>;
/**
 * @summary List employees
 */
export declare function useListEmployees<TData = Awaited<ReturnType<typeof listEmployees>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listEmployees>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateEmployeeUrl: () => string;
/**
 * @summary Create employee
 */
export declare const createEmployee: (employeeInput: EmployeeInput, options?: RequestInit) => Promise<Employee>;
export declare const getCreateEmployeeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEmployee>>, TError, {
        data: BodyType<EmployeeInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createEmployee>>, TError, {
    data: BodyType<EmployeeInput>;
}, TContext>;
export type CreateEmployeeMutationResult = NonNullable<Awaited<ReturnType<typeof createEmployee>>>;
export type CreateEmployeeMutationBody = BodyType<EmployeeInput>;
export type CreateEmployeeMutationError = ErrorType<unknown>;
/**
* @summary Create employee
*/
export declare const useCreateEmployee: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createEmployee>>, TError, {
        data: BodyType<EmployeeInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createEmployee>>, TError, {
    data: BodyType<EmployeeInput>;
}, TContext>;
export declare const getUpdateEmployeeUrl: (id: number) => string;
/**
 * @summary Update employee
 */
export declare const updateEmployee: (id: number, employeeUpdate: EmployeeUpdate, options?: RequestInit) => Promise<Employee>;
export declare const getUpdateEmployeeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEmployee>>, TError, {
        id: number;
        data: BodyType<EmployeeUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateEmployee>>, TError, {
    id: number;
    data: BodyType<EmployeeUpdate>;
}, TContext>;
export type UpdateEmployeeMutationResult = NonNullable<Awaited<ReturnType<typeof updateEmployee>>>;
export type UpdateEmployeeMutationBody = BodyType<EmployeeUpdate>;
export type UpdateEmployeeMutationError = ErrorType<unknown>;
/**
* @summary Update employee
*/
export declare const useUpdateEmployee: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateEmployee>>, TError, {
        id: number;
        data: BodyType<EmployeeUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateEmployee>>, TError, {
    id: number;
    data: BodyType<EmployeeUpdate>;
}, TContext>;
export declare const getDeleteEmployeeUrl: (id: number) => string;
/**
 * @summary Delete employee
 */
export declare const deleteEmployee: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteEmployeeMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteEmployee>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteEmployee>>, TError, {
    id: number;
}, TContext>;
export type DeleteEmployeeMutationResult = NonNullable<Awaited<ReturnType<typeof deleteEmployee>>>;
export type DeleteEmployeeMutationError = ErrorType<unknown>;
/**
* @summary Delete employee
*/
export declare const useDeleteEmployee: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteEmployee>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteEmployee>>, TError, {
    id: number;
}, TContext>;
export declare const getRegenerateEmployeeTokenUrl: (id: number) => string;
/**
 * @summary Regenerate employee access token
 */
export declare const regenerateEmployeeToken: (id: number, options?: RequestInit) => Promise<EmployeeToken>;
export declare const getRegenerateEmployeeTokenMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof regenerateEmployeeToken>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof regenerateEmployeeToken>>, TError, {
    id: number;
}, TContext>;
export type RegenerateEmployeeTokenMutationResult = NonNullable<Awaited<ReturnType<typeof regenerateEmployeeToken>>>;
export type RegenerateEmployeeTokenMutationError = ErrorType<unknown>;
/**
* @summary Regenerate employee access token
*/
export declare const useRegenerateEmployeeToken: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof regenerateEmployeeToken>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof regenerateEmployeeToken>>, TError, {
    id: number;
}, TContext>;
export declare const getListCustomersUrl: (params?: ListCustomersParams) => string;
/**
 * @summary List customers
 */
export declare const listCustomers: (params?: ListCustomersParams, options?: RequestInit) => Promise<Customer[]>;
export declare const getListCustomersQueryKey: (params?: ListCustomersParams) => readonly ["/api/customers", ...ListCustomersParams[]];
export declare const getListCustomersQueryOptions: <TData = Awaited<ReturnType<typeof listCustomers>>, TError = ErrorType<unknown>>(params?: ListCustomersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCustomers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCustomers>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCustomersQueryResult = NonNullable<Awaited<ReturnType<typeof listCustomers>>>;
export type ListCustomersQueryError = ErrorType<unknown>;
/**
 * @summary List customers
 */
export declare function useListCustomers<TData = Awaited<ReturnType<typeof listCustomers>>, TError = ErrorType<unknown>>(params?: ListCustomersParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCustomers>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetCustomerUrl: (id: number) => string;
/**
 * @summary Get customer profile
 */
export declare const getCustomer: (id: number, options?: RequestInit) => Promise<Customer>;
export declare const getGetCustomerQueryKey: (id: number) => readonly [`/api/customers/${number}`];
export declare const getGetCustomerQueryOptions: <TData = Awaited<ReturnType<typeof getCustomer>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCustomer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getCustomer>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetCustomerQueryResult = NonNullable<Awaited<ReturnType<typeof getCustomer>>>;
export type GetCustomerQueryError = ErrorType<unknown>;
/**
 * @summary Get customer profile
 */
export declare function useGetCustomer<TData = Awaited<ReturnType<typeof getCustomer>>, TError = ErrorType<unknown>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getCustomer>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListFeedbackUrl: (params?: ListFeedbackParams) => string;
/**
 * @summary List customer feedback
 */
export declare const listFeedback: (params?: ListFeedbackParams, options?: RequestInit) => Promise<Feedback[]>;
export declare const getListFeedbackQueryKey: (params?: ListFeedbackParams) => readonly ["/api/feedback", ...ListFeedbackParams[]];
export declare const getListFeedbackQueryOptions: <TData = Awaited<ReturnType<typeof listFeedback>>, TError = ErrorType<unknown>>(params?: ListFeedbackParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFeedback>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listFeedback>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListFeedbackQueryResult = NonNullable<Awaited<ReturnType<typeof listFeedback>>>;
export type ListFeedbackQueryError = ErrorType<unknown>;
/**
 * @summary List customer feedback
 */
export declare function useListFeedback<TData = Awaited<ReturnType<typeof listFeedback>>, TError = ErrorType<unknown>>(params?: ListFeedbackParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listFeedback>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getRespondToFeedbackUrl: (id: number) => string;
/**
 * @summary Respond to feedback or complaint
 */
export declare const respondToFeedback: (id: number, feedbackResponse: FeedbackResponse, options?: RequestInit) => Promise<Feedback>;
export declare const getRespondToFeedbackMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof respondToFeedback>>, TError, {
        id: number;
        data: BodyType<FeedbackResponse>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof respondToFeedback>>, TError, {
    id: number;
    data: BodyType<FeedbackResponse>;
}, TContext>;
export type RespondToFeedbackMutationResult = NonNullable<Awaited<ReturnType<typeof respondToFeedback>>>;
export type RespondToFeedbackMutationBody = BodyType<FeedbackResponse>;
export type RespondToFeedbackMutationError = ErrorType<unknown>;
/**
* @summary Respond to feedback or complaint
*/
export declare const useRespondToFeedback: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof respondToFeedback>>, TError, {
        id: number;
        data: BodyType<FeedbackResponse>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof respondToFeedback>>, TError, {
    id: number;
    data: BodyType<FeedbackResponse>;
}, TContext>;
export declare const getGetSalesAnalyticsUrl: (params?: GetSalesAnalyticsParams) => string;
/**
 * @summary Sales analytics by period
 */
export declare const getSalesAnalytics: (params?: GetSalesAnalyticsParams, options?: RequestInit) => Promise<SalesAnalytics>;
export declare const getGetSalesAnalyticsQueryKey: (params?: GetSalesAnalyticsParams) => readonly ["/api/analytics/sales", ...GetSalesAnalyticsParams[]];
export declare const getGetSalesAnalyticsQueryOptions: <TData = Awaited<ReturnType<typeof getSalesAnalytics>>, TError = ErrorType<unknown>>(params?: GetSalesAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSalesAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSalesAnalytics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSalesAnalyticsQueryResult = NonNullable<Awaited<ReturnType<typeof getSalesAnalytics>>>;
export type GetSalesAnalyticsQueryError = ErrorType<unknown>;
/**
 * @summary Sales analytics by period
 */
export declare function useGetSalesAnalytics<TData = Awaited<ReturnType<typeof getSalesAnalytics>>, TError = ErrorType<unknown>>(params?: GetSalesAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSalesAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetProductsAnalyticsUrl: (params?: GetProductsAnalyticsParams) => string;
/**
 * @summary Products performance analytics
 */
export declare const getProductsAnalytics: (params?: GetProductsAnalyticsParams, options?: RequestInit) => Promise<ProductsAnalytics>;
export declare const getGetProductsAnalyticsQueryKey: (params?: GetProductsAnalyticsParams) => readonly ["/api/analytics/products", ...GetProductsAnalyticsParams[]];
export declare const getGetProductsAnalyticsQueryOptions: <TData = Awaited<ReturnType<typeof getProductsAnalytics>>, TError = ErrorType<unknown>>(params?: GetProductsAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProductsAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getProductsAnalytics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetProductsAnalyticsQueryResult = NonNullable<Awaited<ReturnType<typeof getProductsAnalytics>>>;
export type GetProductsAnalyticsQueryError = ErrorType<unknown>;
/**
 * @summary Products performance analytics
 */
export declare function useGetProductsAnalytics<TData = Awaited<ReturnType<typeof getProductsAnalytics>>, TError = ErrorType<unknown>>(params?: GetProductsAnalyticsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getProductsAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetHoursAnalyticsUrl: () => string;
/**
 * @summary Sales by hour of day
 */
export declare const getHoursAnalytics: (options?: RequestInit) => Promise<HourData[]>;
export declare const getGetHoursAnalyticsQueryKey: () => readonly ["/api/analytics/hours"];
export declare const getGetHoursAnalyticsQueryOptions: <TData = Awaited<ReturnType<typeof getHoursAnalytics>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHoursAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getHoursAnalytics>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetHoursAnalyticsQueryResult = NonNullable<Awaited<ReturnType<typeof getHoursAnalytics>>>;
export type GetHoursAnalyticsQueryError = ErrorType<unknown>;
/**
 * @summary Sales by hour of day
 */
export declare function useGetHoursAnalytics<TData = Awaited<ReturnType<typeof getHoursAnalytics>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getHoursAnalytics>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAnalyticsOverviewUrl: (params?: GetAnalyticsOverviewParams) => string;
/**
 * @summary Full analytics overview (revenue, orders, ticket, trends)
 */
export declare const getAnalyticsOverview: (params?: GetAnalyticsOverviewParams, options?: RequestInit) => Promise<AnalyticsOverview>;
export declare const getGetAnalyticsOverviewQueryKey: (params?: GetAnalyticsOverviewParams) => readonly ["/api/analytics/overview", ...GetAnalyticsOverviewParams[]];
export declare const getGetAnalyticsOverviewQueryOptions: <TData = Awaited<ReturnType<typeof getAnalyticsOverview>>, TError = ErrorType<unknown>>(params?: GetAnalyticsOverviewParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsOverview>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsOverview>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalyticsOverviewQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalyticsOverview>>>;
export type GetAnalyticsOverviewQueryError = ErrorType<unknown>;
/**
 * @summary Full analytics overview (revenue, orders, ticket, trends)
 */
export declare function useGetAnalyticsOverview<TData = Awaited<ReturnType<typeof getAnalyticsOverview>>, TError = ErrorType<unknown>>(params?: GetAnalyticsOverviewParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalyticsOverview>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListCampaignsUrl: () => string;
/**
 * @summary List marketing campaigns
 */
export declare const listCampaigns: (options?: RequestInit) => Promise<Campaign[]>;
export declare const getListCampaignsQueryKey: () => readonly ["/api/marketing/campaigns"];
export declare const getListCampaignsQueryOptions: <TData = Awaited<ReturnType<typeof listCampaigns>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCampaigns>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listCampaigns>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListCampaignsQueryResult = NonNullable<Awaited<ReturnType<typeof listCampaigns>>>;
export type ListCampaignsQueryError = ErrorType<unknown>;
/**
 * @summary List marketing campaigns
 */
export declare function useListCampaigns<TData = Awaited<ReturnType<typeof listCampaigns>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listCampaigns>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateCampaignUrl: () => string;
/**
 * @summary Generate AI marketing campaign
 */
export declare const createCampaign: (campaignInput: CampaignInput, options?: RequestInit) => Promise<Campaign>;
export declare const getCreateCampaignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCampaign>>, TError, {
        data: BodyType<CampaignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createCampaign>>, TError, {
    data: BodyType<CampaignInput>;
}, TContext>;
export type CreateCampaignMutationResult = NonNullable<Awaited<ReturnType<typeof createCampaign>>>;
export type CreateCampaignMutationBody = BodyType<CampaignInput>;
export type CreateCampaignMutationError = ErrorType<unknown>;
/**
* @summary Generate AI marketing campaign
*/
export declare const useCreateCampaign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createCampaign>>, TError, {
        data: BodyType<CampaignInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createCampaign>>, TError, {
    data: BodyType<CampaignInput>;
}, TContext>;
export declare const getDeleteCampaignUrl: (id: number) => string;
/**
 * @summary Delete campaign
 */
export declare const deleteCampaign: (id: number, options?: RequestInit) => Promise<void>;
export declare const getDeleteCampaignMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
    id: number;
}, TContext>;
export type DeleteCampaignMutationResult = NonNullable<Awaited<ReturnType<typeof deleteCampaign>>>;
export type DeleteCampaignMutationError = ErrorType<unknown>;
/**
* @summary Delete campaign
*/
export declare const useDeleteCampaign: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteCampaign>>, TError, {
    id: number;
}, TContext>;
export declare const getAiChatUrl: () => string;
/**
 * @summary AI assistant chat for business analysis and recommendations
 */
export declare const aiChat: (aiChatInput: AiChatInput, options?: RequestInit) => Promise<AiReply>;
export declare const getAiChatMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof aiChat>>, TError, {
        data: BodyType<AiChatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof aiChat>>, TError, {
    data: BodyType<AiChatInput>;
}, TContext>;
export type AiChatMutationResult = NonNullable<Awaited<ReturnType<typeof aiChat>>>;
export type AiChatMutationBody = BodyType<AiChatInput>;
export type AiChatMutationError = ErrorType<unknown>;
/**
* @summary AI assistant chat for business analysis and recommendations
*/
export declare const useAiChat: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof aiChat>>, TError, {
        data: BodyType<AiChatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof aiChat>>, TError, {
    data: BodyType<AiChatInput>;
}, TContext>;
export declare const getGetAiChatHistoryUrl: (params?: GetAiChatHistoryParams) => string;
/**
 * @summary Get AI chat history
 */
export declare const getAiChatHistory: (params?: GetAiChatHistoryParams, options?: RequestInit) => Promise<AiChatMessage[]>;
export declare const getGetAiChatHistoryQueryKey: (params?: GetAiChatHistoryParams) => readonly ["/api/ai/chat/history", ...GetAiChatHistoryParams[]];
export declare const getGetAiChatHistoryQueryOptions: <TData = Awaited<ReturnType<typeof getAiChatHistory>>, TError = ErrorType<unknown>>(params?: GetAiChatHistoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiChatHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAiChatHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAiChatHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getAiChatHistory>>>;
export type GetAiChatHistoryQueryError = ErrorType<unknown>;
/**
 * @summary Get AI chat history
 */
export declare function useGetAiChatHistory<TData = Awaited<ReturnType<typeof getAiChatHistory>>, TError = ErrorType<unknown>>(params?: GetAiChatHistoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiChatHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAiInsightsUrl: () => string;
/**
 * @summary AI-generated business insights and recommendations
 */
export declare const getAiInsights: (options?: RequestInit) => Promise<AiInsights>;
export declare const getGetAiInsightsQueryKey: () => readonly ["/api/ai/insights"];
export declare const getGetAiInsightsQueryOptions: <TData = Awaited<ReturnType<typeof getAiInsights>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiInsights>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAiInsights>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAiInsightsQueryResult = NonNullable<Awaited<ReturnType<typeof getAiInsights>>>;
export type GetAiInsightsQueryError = ErrorType<unknown>;
/**
 * @summary AI-generated business insights and recommendations
 */
export declare function useGetAiInsights<TData = Awaited<ReturnType<typeof getAiInsights>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiInsights>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetNutritionProfileUrl: () => string;
/**
 * @summary Get nutrition profile (customer-facing for this restaurant)
 */
export declare const getNutritionProfile: (options?: RequestInit) => Promise<NutritionProfile>;
export declare const getGetNutritionProfileQueryKey: () => readonly ["/api/nutrition/profile"];
export declare const getGetNutritionProfileQueryOptions: <TData = Awaited<ReturnType<typeof getNutritionProfile>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNutritionProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getNutritionProfile>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetNutritionProfileQueryResult = NonNullable<Awaited<ReturnType<typeof getNutritionProfile>>>;
export type GetNutritionProfileQueryError = ErrorType<unknown>;
/**
 * @summary Get nutrition profile (customer-facing for this restaurant)
 */
export declare function useGetNutritionProfile<TData = Awaited<ReturnType<typeof getNutritionProfile>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNutritionProfile>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateNutritionProfileUrl: () => string;
/**
 * @summary Update nutrition profile settings
 */
export declare const updateNutritionProfile: (nutritionProfileUpdate: NutritionProfileUpdate, options?: RequestInit) => Promise<NutritionProfile>;
export declare const getUpdateNutritionProfileMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateNutritionProfile>>, TError, {
        data: BodyType<NutritionProfileUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateNutritionProfile>>, TError, {
    data: BodyType<NutritionProfileUpdate>;
}, TContext>;
export type UpdateNutritionProfileMutationResult = NonNullable<Awaited<ReturnType<typeof updateNutritionProfile>>>;
export type UpdateNutritionProfileMutationBody = BodyType<NutritionProfileUpdate>;
export type UpdateNutritionProfileMutationError = ErrorType<unknown>;
/**
* @summary Update nutrition profile settings
*/
export declare const useUpdateNutritionProfile: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateNutritionProfile>>, TError, {
        data: BodyType<NutritionProfileUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateNutritionProfile>>, TError, {
    data: BodyType<NutritionProfileUpdate>;
}, TContext>;
export declare const getAnalyzeFoodUrl: () => string;
/**
 * @summary Analyze food/dish nutritional info via AI
 */
export declare const analyzeFood: (foodAnalysisInput: FoodAnalysisInput, options?: RequestInit) => Promise<FoodAnalysisResult>;
export declare const getAnalyzeFoodMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeFood>>, TError, {
        data: BodyType<FoodAnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof analyzeFood>>, TError, {
    data: BodyType<FoodAnalysisInput>;
}, TContext>;
export type AnalyzeFoodMutationResult = NonNullable<Awaited<ReturnType<typeof analyzeFood>>>;
export type AnalyzeFoodMutationBody = BodyType<FoodAnalysisInput>;
export type AnalyzeFoodMutationError = ErrorType<unknown>;
/**
* @summary Analyze food/dish nutritional info via AI
*/
export declare const useAnalyzeFood: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof analyzeFood>>, TError, {
        data: BodyType<FoodAnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof analyzeFood>>, TError, {
    data: BodyType<FoodAnalysisInput>;
}, TContext>;
export declare const getNutritionChatUrl: () => string;
/**
 * @summary Nutritional AI chat
 */
export declare const nutritionChat: (nutritionChatInput: NutritionChatInput, options?: RequestInit) => Promise<NutritionAdvice>;
export declare const getNutritionChatMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof nutritionChat>>, TError, {
        data: BodyType<NutritionChatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof nutritionChat>>, TError, {
    data: BodyType<NutritionChatInput>;
}, TContext>;
export type NutritionChatMutationResult = NonNullable<Awaited<ReturnType<typeof nutritionChat>>>;
export type NutritionChatMutationBody = BodyType<NutritionChatInput>;
export type NutritionChatMutationError = ErrorType<unknown>;
/**
* @summary Nutritional AI chat
*/
export declare const useNutritionChat: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof nutritionChat>>, TError, {
        data: BodyType<NutritionChatInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof nutritionChat>>, TError, {
    data: BodyType<NutritionChatInput>;
}, TContext>;
export declare const getGetNutritionHistoryUrl: (params?: GetNutritionHistoryParams) => string;
/**
 * @summary Nutritional analysis history
 */
export declare const getNutritionHistory: (params?: GetNutritionHistoryParams, options?: RequestInit) => Promise<NutritionRecord[]>;
export declare const getGetNutritionHistoryQueryKey: (params?: GetNutritionHistoryParams) => readonly ["/api/nutrition/history", ...GetNutritionHistoryParams[]];
export declare const getGetNutritionHistoryQueryOptions: <TData = Awaited<ReturnType<typeof getNutritionHistory>>, TError = ErrorType<unknown>>(params?: GetNutritionHistoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNutritionHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getNutritionHistory>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetNutritionHistoryQueryResult = NonNullable<Awaited<ReturnType<typeof getNutritionHistory>>>;
export type GetNutritionHistoryQueryError = ErrorType<unknown>;
/**
 * @summary Nutritional analysis history
 */
export declare function useGetNutritionHistory<TData = Awaited<ReturnType<typeof getNutritionHistory>>, TError = ErrorType<unknown>>(params?: GetNutritionHistoryParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getNutritionHistory>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListAuditLogsUrl: (params?: ListAuditLogsParams) => string;
/**
 * @summary List audit logs
 */
export declare const listAuditLogs: (params?: ListAuditLogsParams, options?: RequestInit) => Promise<AuditLog[]>;
export declare const getListAuditLogsQueryKey: (params?: ListAuditLogsParams) => readonly ["/api/audit", ...ListAuditLogsParams[]];
export declare const getListAuditLogsQueryOptions: <TData = Awaited<ReturnType<typeof listAuditLogs>>, TError = ErrorType<unknown>>(params?: ListAuditLogsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAuditLogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAuditLogs>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAuditLogsQueryResult = NonNullable<Awaited<ReturnType<typeof listAuditLogs>>>;
export type ListAuditLogsQueryError = ErrorType<unknown>;
/**
 * @summary List audit logs
 */
export declare function useListAuditLogs<TData = Awaited<ReturnType<typeof listAuditLogs>>, TError = ErrorType<unknown>>(params?: ListAuditLogsParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAuditLogs>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetSettingsUrl: () => string;
/**
 * @summary Get restaurant settings
 */
export declare const getSettings: (options?: RequestInit) => Promise<RestaurantSettings>;
export declare const getGetSettingsQueryKey: () => readonly ["/api/settings"];
export declare const getGetSettingsQueryOptions: <TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetSettingsQueryResult = NonNullable<Awaited<ReturnType<typeof getSettings>>>;
export type GetSettingsQueryError = ErrorType<unknown>;
/**
 * @summary Get restaurant settings
 */
export declare function useGetSettings<TData = Awaited<ReturnType<typeof getSettings>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getSettings>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getUpdateSettingsUrl: () => string;
/**
 * @summary Update restaurant settings
 */
export declare const updateSettings: (restaurantSettingsUpdate: RestaurantSettingsUpdate, options?: RequestInit) => Promise<RestaurantSettings>;
export declare const getUpdateSettingsMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
        data: BodyType<RestaurantSettingsUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
    data: BodyType<RestaurantSettingsUpdate>;
}, TContext>;
export type UpdateSettingsMutationResult = NonNullable<Awaited<ReturnType<typeof updateSettings>>>;
export type UpdateSettingsMutationBody = BodyType<RestaurantSettingsUpdate>;
export type UpdateSettingsMutationError = ErrorType<unknown>;
/**
* @summary Update restaurant settings
*/
export declare const useUpdateSettings: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof updateSettings>>, TError, {
        data: BodyType<RestaurantSettingsUpdate>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof updateSettings>>, TError, {
    data: BodyType<RestaurantSettingsUpdate>;
}, TContext>;
export declare const getExportBackupUrl: () => string;
/**
 * @summary Create data backup
 */
export declare const exportBackup: (options?: RequestInit) => Promise<BackupResult>;
export declare const getExportBackupMutationOptions: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof exportBackup>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof exportBackup>>, TError, void, TContext>;
export type ExportBackupMutationResult = NonNullable<Awaited<ReturnType<typeof exportBackup>>>;
export type ExportBackupMutationError = ErrorType<unknown>;
/**
* @summary Create data backup
*/
export declare const useExportBackup: <TError = ErrorType<unknown>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof exportBackup>>, TError, void, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof exportBackup>>, TError, void, TContext>;
export declare const getListBackupsUrl: () => string;
/**
 * @summary List available backups
 */
export declare const listBackups: (options?: RequestInit) => Promise<BackupEntry[]>;
export declare const getListBackupsQueryKey: () => readonly ["/api/backup/list"];
export declare const getListBackupsQueryOptions: <TData = Awaited<ReturnType<typeof listBackups>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBackups>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listBackups>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListBackupsQueryResult = NonNullable<Awaited<ReturnType<typeof listBackups>>>;
export type ListBackupsQueryError = ErrorType<unknown>;
/**
 * @summary List available backups
 */
export declare function useListBackups<TData = Awaited<ReturnType<typeof listBackups>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBackups>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map