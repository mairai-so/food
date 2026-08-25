import { useLoginOwner, useGetMe, getMeQueryKey } from "@workspace/api-client-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function useAuthGuard() {
  const [location, setLocation] = useLocation();
  const token = localStorage.getItem("gestor_token");

  const { data: me, isLoading, isError } = useGetMe({
    query: {
      queryKey: getMeQueryKey(),
      enabled: !!token,
      retry: false,
    }
  });

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    } else if (isError) {
      localStorage.removeItem("gestor_token");
      setLocation("/login");
    }
  }, [token, isError, setLocation]);

  return { isAuthenticated: !!me, me, isLoading };
}
