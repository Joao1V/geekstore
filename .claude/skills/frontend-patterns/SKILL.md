---
name: frontend-patterns
description: Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices.
metadata:
  origin: ECC
---

# Frontend Development Patterns

Modern frontend patterns for React, Next.js, and performant user interfaces.

## When to Activate

- Building React components (composition, props, rendering)
- Managing state (useState locally, Zustand globally — no useReducer, no Context)
- Implementing data fetching (React Query, server components)
- Optimizing performance (memoization, virtualization, code splitting)
- Working with forms (validation, controlled inputs, Zod schemas)
- Handling client-side routing and navigation
- Building accessible, responsive UI patterns

## Component Patterns

### Composition Over Inheritance

```typescript
// PASS: GOOD: Component composition
interface CardProps {
  children: React.ReactNode
  variant?: 'default' | 'outlined'
}

export function Card({ children, variant = 'default' }: CardProps) {
  return <div className={`card card-${variant}`}>{children}</div>
}

export function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="card-header">{children}</div>
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="card-body">{children}</div>
}

// Usage
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

### Compound Components

Use HeroUI's compound components (Tabs, Accordion, Modal, ...) — they already own their state
(docs: https://heroui.com/en/docs/react/components/tabs). For a custom one, state lives in a
Zustand store, never in Context:

```typescript
import { create } from 'zustand'

interface TabsState {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const useTabsStore = create<TabsState>((set) => ({
  activeTab: 'overview',
  setActiveTab: (tab) => set({ activeTab: tab }),
}))

export function Tab({ id, children }: { id: string, children: React.ReactNode }) {
  const isActive = useTabsStore((s) => s.activeTab === id)
  const setActiveTab = useTabsStore((s) => s.setActiveTab)

  return (
    <button className={isActive ? 'active' : ''} onClick={() => setActiveTab(id)}>
      {children}
    </button>
  )
}
```

A module-level store is shared by every instance; if two instances of the widget can coexist
on a page, prefer HeroUI's component (or plain props) instead.

### Render Props Pattern

```typescript
interface DisclosureProps {
  children: (isOpen: boolean, toggle: () => void) => React.ReactNode
}

export function Disclosure({ children }: DisclosureProps) {
  const [isOpen, setIsOpen] = useState(false)
  return <>{children(isOpen, () => setIsOpen(open => !open))}</>
}

// Usage
<Disclosure>
  {(isOpen, toggle) => (
    <>
      <button onClick={toggle}>Ver detalhes do produto</button>
      {isOpen && <ProductDetails />}
    </>
  )}
</Disclosure>
```

Data loading does not go through render props or hand-rolled hooks — see
"Server Data Fetching Hook" below.

## Custom Hooks Patterns

### State Management Hook

```typescript
export function useToggle(initialValue = false): [boolean, () => void] {
  const [value, setValue] = useState(initialValue)

  const toggle = useCallback(() => {
    setValue(v => !v)
  }, [])

  return [value, toggle]
}

// Usage
const [isOpen, toggleOpen] = useToggle()
```

### Server Data Fetching

Server data in `apps/web` goes through React Query, prefetched in a Server Component and hydrated
with `HydrationBoundary` — never a hand-written `useState` + `useEffect` + `fetch` hook, and no
inline `fetch` in components. Every API call is a service (`queryOptions` factory in
`services/<domain>/queries.ts`, `useMutation` in `mutations.ts`) built on the shared `lib/api`
client, with types from `@geekstore/shared`. The full contract is the `scaffolding-api-service`
skill.

```typescript
// component: call useQuery with the factory directly, no wrapper hook
const { data: sku, isPending, error, refetch } = useQuery(skuQueryOptions('FUN-POP-1248'))
```

### Debounce Hook

use lib use-debounce


### Memoization

```typescript
// PASS: useMemo for expensive computations
// Copy before sorting - Array.prototype.sort mutates in place
const sortedProducts = useMemo(() => {
  return [...products].sort((a, b) => a.price_cents - b.price_cents)
}, [products])

// PASS: useCallback for functions passed to children
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])

// PASS: React.memo for pure components
export const ProductCard = React.memo<ProductCardProps>(({ product }) => {
  return (
    <div className="product-card">
      <h3>{product.name}</h3>
      <p>{product.description}</p>
    </div>
  )
})
```

### Code Splitting & Lazy Loading

```typescript
import { lazy, Suspense } from 'react'

// PASS: Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'))
const ThreeJsBackground = lazy(() => import('./ThreeJsBackground'))

export function Dashboard() {
  return (
    <div>
      <Suspense fallback={<ChartSkeleton />}>
        <HeavyChart data={data} />
      </Suspense>

      <Suspense fallback={null}>
        <ThreeJsBackground />
      </Suspense>
    </div>
  )
}
```

### Virtualization for Long Lists

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualProductList({ products }: { products: Product[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,  // Estimated row height
    overscan: 5  // Extra items to render
  })

  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <ProductCard product={products[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Form Handling Patterns

**In `apps/web`, every form uses react-hook-form + an explicit `<Controller>` around each field —
never raw `useState` for values/errors like the generic pattern below. See the `form-fields`
skill for the full contract (the `FieldInput`/`FieldSelect`/... family in `components/ui/`,
`isInvalid`/error derivation, validation via a shared Zod schema). Reference implementation:
`apps/web/modules/admin/admin-login.tsx`.

### Controlled Form with react-hook-form + Zod

```typescript
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { z } from 'zod'
import { FieldInput } from '@/components/ui'
import { Button } from '@heroui/react'

const createProductSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório').max(200, 'Máximo 200 caracteres'),
  description: z.string().min(1, 'Descrição obrigatória'),
  slug: z.string().min(1, 'Slug obrigatório'),
})
type CreateProductFormValues = z.infer<typeof createProductSchema>

export function CreateProductForm() {
  const { control, handleSubmit } = useForm<CreateProductFormValues>({
    resolver: zodResolver(createProductSchema),
  })

  const submit = async (data: CreateProductFormValues) => {
    try {
      await createProduct(data)
      // Success handling
    } catch (error) {
      // Error handling
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)}>
      <Controller
        control={control}
        name="name"
        render={({ field, fieldState }) => (
          <FieldInput field={field} fieldState={fieldState} label="Nome do produto" />
        )}
      />

      {/* Other fields, same Controller + Field* shape */}

      <Button type="submit">Criar produto</Button>
    </form>
  )
}
```

## Error Boundary Pattern

```typescript
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: null
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Usage
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

## Animation Patterns

### Motion Animations

```typescript
import { AnimatePresence, motion } from 'motion/react'

// PASS: List animations
export function AnimatedProductList({ products }: { products: Product[] }) {
  return (
    <AnimatePresence>
      {products.map(product => (
        <motion.div
          key={product.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <ProductCard product={product} />
        </motion.div>
      ))}
    </AnimatePresence>
  )
}

// PASS: Modal animations
export function Modal({ isOpen, onClose, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="modal-content"
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
```

### Keyboard Navigation

```typescript
export function Dropdown({ options, onSelect }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        onSelect(options[activeIndex])
        setIsOpen(false)
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div
      role="combobox"
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      onKeyDown={handleKeyDown}
    >
      {/* Dropdown implementation */}
    </div>
  )
}
```

**Remember**: Modern frontend patterns enable maintainable, performant user interfaces. Choose patterns that fit your project complexity.
