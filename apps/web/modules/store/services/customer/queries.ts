import type { Address } from '@geekstore/shared';
import { queryOptions } from '@tanstack/react-query';

import { customerApi } from '../../lib/customer-api';
import { customerKeys } from './keys';

export const addressesQuery = () =>
  queryOptions({
    queryKey: customerKeys.addresses,
    queryFn: () => customerApi.get<Address[]>('/api/customer/addresses'),
  });
