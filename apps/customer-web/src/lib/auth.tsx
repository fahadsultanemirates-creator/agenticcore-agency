import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetAgencyAuthMeQueryKey,
  useGetAgencyAuthMe,
  useAgencyLogout,
  type AgencyCustomer,
} from '@workspace/api-client-react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- re-export for consumers
export type { AgencyCustomer };

interface AuthContextValue {
  customer: AgencyCustomer | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  customer: null,
  isLoading: true,
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetAgencyAuthMe({
    query: {
      queryKey: getGetAgencyAuthMeQueryKey(),
      retry: false,
      staleTime: 5 * 60 * 1000,
    },
  });

  const { mutate: doLogout } = useAgencyLogout({
    mutation: {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = '/agenticcore-agency/login';
      },
    },
  });

  const customer = data?.customer ?? null;

  return (
    <AuthContext.Provider value={{ customer, isLoading, logout: () => doLogout() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
