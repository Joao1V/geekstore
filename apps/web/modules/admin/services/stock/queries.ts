import type {
  Location,
  StockLevel,
  StockLevelListQuery,
  StockMovement,
  StockMovementListQuery,
} from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { adminApi } from '../../lib/admin-api';
import { adminKeys } from '../query-keys';

export const locationsQueryOptions = () =>
  queryOptions({
    queryKey: adminKeys.locations,
    queryFn: () => adminApi.get<Location[]>('/api/stock/locations'),
  });

export const stockLevelsQueryOptions = (params: Partial<StockLevelListQuery>) =>
  queryOptions({
    queryKey: [...adminKeys.stockLevels, params],
    queryFn: () => adminApi.paginate<StockLevel>('/api/stock/levels', params),
  });

export const movementListQueryOptions = (params: Partial<StockMovementListQuery>) =>
  queryOptions({
    queryKey: adminKeys.movementList(params),
    queryFn: () => adminApi.paginate<StockMovement>('/api/stock/movements', params),
  });
