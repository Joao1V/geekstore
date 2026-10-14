'use client';

import { Label, SearchField } from '@heroui/react';
import { useEffect } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';

const DEBOUNCE_MS = 350;

/** Busca "digitando": useForm + Controller, lendo o valor com useWatch e aplicando com debounce. */
export function SearchBox({
  label = 'Buscar',
  initialValue,
  onSearch,
}: {
  label?: string;
  initialValue: string;
  onSearch: (value: string) => void;
}) {
  const { control } = useForm<{ q: string }>({ defaultValues: { q: initialValue } });
  const q = useWatch({ control, name: 'q' });

  useEffect(() => {
    if (q.trim() === initialValue) return;
    const timer = setTimeout(() => onSearch(q.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, initialValue, onSearch]);

  return (
    <Controller
      control={control}
      name="q"
      render={({ field }) => (
        <SearchField
          name={field.name}
          value={field.value}
          onChange={field.onChange}
          onBlur={field.onBlur}
          fullWidth
          className="form-field"
        >
          <Label>{label}</Label>
          <SearchField.Group>
            <SearchField.SearchIcon />
            <SearchField.Input ref={field.ref} placeholder="Digite para buscar…" />
            <SearchField.ClearButton />
          </SearchField.Group>
        </SearchField>
      )}
    />
  );
}
