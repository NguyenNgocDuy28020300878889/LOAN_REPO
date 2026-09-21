import { QueryClient } from '@tanstack/react-query';

export function createAccountQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
}

export function disposeAccountQueryClient(client: QueryClient) {
  void client.cancelQueries();
  client.clear();
}
