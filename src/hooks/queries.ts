import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Category, Facets, Order, Product, ProductList, PublicConfig } from '../lib/types';
import { useCustomer } from '../store/auth';

export const useConfig = () =>
  useQuery({ queryKey: ['config'], queryFn: () => api<PublicConfig>('/settings'), staleTime: 5 * 60_000 });

export const useCategories = () =>
  useQuery({
    queryKey: ['categories'],
    queryFn: () => api<{ categories: Category[] }>('/categories').then((r) => r.categories),
    staleTime: 5 * 60_000,
  });

export interface ProductFilters {
  category?: string;
  brand?: string[];
  size?: string[];
  color?: string[];
  min?: number;
  max?: number;
  inStock?: boolean;
  featured?: boolean;
  new?: boolean;
  q?: string;
  sort?: 'new' | 'price_asc' | 'price_desc' | 'featured';
  limit?: number;
  exclude?: string;
}

export const useProducts = (filters: ProductFilters, enabled = true) =>
  useQuery({
    queryKey: ['products', filters],
    queryFn: ({ signal }) => api<ProductList>('/products', { query: { ...filters }, signal }),
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 60_000,
  });

export const useInfiniteProducts = (filters: ProductFilters, enabled = true) =>
  useInfiniteQuery({
    enabled,
    queryKey: ['products-infinite', filters],
    queryFn: ({ pageParam, signal }) => api<ProductList>('/products', { query: { ...filters, page: pageParam, limit: 24 }, signal }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

export const useProduct = (slug: string | undefined) =>
  useQuery({
    queryKey: ['product', slug],
    queryFn: () => api<{ product: Product }>(`/products/${slug}`).then((r) => r.product),
    enabled: Boolean(slug),
    staleTime: 60_000,
    retry: (count, err) => (err as { status?: number }).status !== 404 && count < 2,
  });

export const useFacets = (category?: string) =>
  useQuery({
    queryKey: ['facets', category],
    queryFn: () => api<Facets>('/facets', { query: { category } }),
    staleTime: 5 * 60_000,
  });

export const useMyOrders = () => {
  const token = useCustomer((s) => s.token);
  return useQuery({
    queryKey: ['my-orders', token],
    queryFn: () => api<{ orders: Order[] }>('/orders/mine').then((r) => r.orders),
    enabled: Boolean(token),
  });
};

export const useOrder = (orderNumber: string | undefined) => {
  const token = useCustomer((s) => s.token);
  return useQuery({
    queryKey: ['order', orderNumber, token],
    queryFn: () => api<{ order: Order }>(`/orders/${orderNumber}`).then((r) => r.order),
    enabled: Boolean(orderNumber && token),
    refetchInterval: (q) => {
      const o = q.state.data;
      return o && (o.paymentStatus === 'SUBMITTED' || o.status === 'OUT_FOR_DELIVERY') ? 15_000 : false;
    },
  });
};
