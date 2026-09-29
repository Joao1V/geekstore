---
name: coding-standards
description: Baseline cross-project coding conventions for naming, readability, immutability, and code-quality review. Use detailed frontend or backend skills for framework-specific patterns.
metadata:
  origin: ECC
---

# Coding Standards & Best Practices

Baseline coding conventions applicable across projects.

This skill is the shared floor, not the detailed framework playbook.

- Use `frontend-patterns` for React, state, forms, rendering, and UI architecture.
- Use `backend-patterns` or `api-design` for repository/service layers, endpoint design, validation, and server-specific concerns.
- Use `rules/common/coding-style.md` when you need the shortest reusable rule layer instead of a full skill walkthrough.

## When to Activate

- Starting a new project or module
- Reviewing code for quality and maintainability
- Refactoring existing code to follow conventions
- Enforcing naming, formatting, or structural consistency
- Setting up linting, formatting, or type-checking rules
- Onboarding new contributors to coding conventions

## Note for this project (GeekStore)

Examples use GeekStore's domain (SKU, order, stock, money in cents). The API lives entirely in
`apps/api` (Fastify + Prisma via `@geekstore/db`) — see the `fastify-module-scaffolding` and
`db-conventions` skills for the real patterns. File names in `apps/web` are kebab-case.

## Scope Boundaries

Activate this skill for:
- descriptive naming
- immutability defaults
- readability, KISS, DRY, and YAGNI enforcement
- error-handling expectations and code-smell review

Do not use this skill as the primary source for:
- React composition, hooks, or rendering patterns
- backend architecture, API design, or database layering
- domain-specific framework guidance when a narrower ECC skill already exists

## Code Quality Principles

### 1. Readability First
- Code is read more than written
- Clear variable and function names
- Self-documenting code preferred over comments
- Consistent formatting

### 2. KISS (Keep It Simple, Stupid)
- Simplest solution that works
- Avoid over-engineering
- No premature optimization
- Easy to understand > clever code

### 3. DRY (Don't Repeat Yourself)
- Extract common logic into functions
- Create reusable components
- Share utilities across modules
- Avoid copy-paste programming

### 4. YAGNI (You Aren't Gonna Need It)
- Don't build features before they're needed
- Avoid speculative generality
- Add complexity only when required
- Start simple, refactor when needed

## TypeScript/JavaScript Standards

### Variable Naming

```typescript
// PASS: GOOD: Descriptive names
const skuSearchQuery = 'election'
const isUserAuthenticated = true
const totalRevenue = 1000

// FAIL: BAD: Unclear names
const q = 'election'
const flag = true
const x = 1000
```

### Function Naming

```typescript
// PASS: GOOD: Verb-noun pattern
async function fetchSkuData(skuId: string) { }
function calculateInstallment(totalCents: number, installments: number) { }
function isValidEmail(email: string): boolean { }

// FAIL: BAD: Unclear or noun-only
async function sku(id: string) { }
function installment(a, b) { }
function email(e) { }
```

### Immutability Pattern (CRITICAL)

```typescript
// PASS: ALWAYS use spread operator
const updatedUser = {
  ...user,
  name: 'New Name'
}

const updatedArray = [...items, newItem]

// FAIL: NEVER mutate directly
user.name = 'New Name'  // BAD
items.push(newItem)     // BAD
```

### Error Handling

```typescript
// PASS: GOOD: Comprehensive error handling
async function fetchData(url: string) {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Fetch failed:', error)
    throw new Error('Failed to fetch data')
  }
}

// FAIL: BAD: No error handling
async function fetchData(url) {
  const response = await fetch(url)
  return response.json()
}
```

### Async/Await Best Practices

```typescript
// PASS: GOOD: Parallel execution when possible
const [orders, skus, stats] = await Promise.all([
  fetchOrders(),
  fetchSkus(),
  fetchStats()
])

// FAIL: BAD: Sequential when unnecessary
const orders = await fetchOrders()
const skus = await fetchSkus()
const stats = await fetchStats()
```

### Type Safety

```typescript
// PASS: GOOD: Proper types
interface Order {
  order_id: string
  status: 'new' | 'awaiting_payment' | 'paid' | 'shipped' | 'cancelled'
  total_cents: number
  created_at: Date
}

function getOrder(orderId: string): Promise<Order> {
  // Implementation
}

// FAIL: BAD: Using 'any'
function getOrder(orderId: any): Promise<any> {
  // Implementation
}
```

## React Best Practices

### Component Structure

```typescript
// PASS: GOOD: Functional component with types
interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary'
}

export function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary'
}: ButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn btn-${variant}`}
    >
      {children}
    </button>
  )
}

// FAIL: BAD: No types, unclear structure
export function Button(props) {
  return <button onClick={props.onClick}>{props.children}</button>
}
```

### Custom Hooks

```typescript
// PASS: GOOD: Reusable custom hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Usage
const debouncedQuery = useDebounce(searchQuery, 500)
```

### State Management

```typescript
// PASS: GOOD: Proper state updates
const [count, setCount] = useState(0)

// Functional update for state based on previous state
setCount(prev => prev + 1)

// FAIL: BAD: Direct state reference
setCount(count + 1)  // Can be stale in async scenarios
```

### Conditional Rendering

```typescript
// PASS: GOOD: Clear conditional rendering
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataDisplay data={data} />}

// FAIL: BAD: Ternary hell
{isLoading ? <Spinner /> : error ? <ErrorMessage error={error} /> : data ? <DataDisplay data={data} /> : null}
```

## API Design Standards

This project's API lives in `apps/api` (Fastify + Zod, contracts in `packages/shared`), with every
input validated by a Zod schema. See the `fastify-module-scaffolding` skill for routes, errors and
response shapes, and `docs/api/` (generated by `/openapi-docs`) for the current endpoints.

## File Organization

### Project Structure

```
apps/
├── api/src/modules/<domain>/   # Fastify: routes, controller, service per domain
└── web/
    ├── app/(store)/  app/(admin)/     # route groups, split by APP_MODE
    ├── modules/store/  modules/admin/ # feature code, never cross-imported
    └── components/ui/  lib/           # shared between both modes
packages/
├── shared/   # Zod schemas and types (API + web)
├── db/       # Prisma schema and client (API only)
└── config/   # tsconfig
```

### File Naming

Generic convention is PascalCase per component (`components/Button.tsx`) — **this project uses
kebab-case everywhere in `apps/web` instead** (`admin-login.tsx`, `campaign-slider.tsx`), and a
component kit that would otherwise grow into one giant file becomes a flat folder + `index.ts`
barrel, not one folder per component (see `components/ui/` and `CLAUDE.md`). Follow the local
convention here, not the generic one:

```
modules/admin/admin-login.tsx  # kebab-case, not PascalCase
modules/store/state/cart-store.ts
components/ui/field-input.tsx  # + components/ui/index.ts barrel
```

## Comments & Documentation

### When to Comment

```typescript
// PASS: GOOD: Explain WHY, not WHAT
// Use exponential backoff to avoid overwhelming the API during outages
const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)

// FAIL: BAD: Stating the obvious
// Increment counter by 1
count++

// Set name to user's name
name = user.name
```

### JSDoc for Public APIs

```typescript
/**
 * Reserves stock for an order inside the order transaction.
 *
 * @param skuId - SKU to reserve
 * @param quantity - Units to reserve (positive integer)
 * @returns The new available balance
 * @throws {InsufficientStockError} If available stock is lower than quantity
 */
export async function reserveStock(
  skuId: string,
  quantity: number
): Promise<number> {
  // Implementation
}
```

## Performance Best Practices

### Memoization

```typescript
import { useMemo, useCallback } from 'react'

// PASS: GOOD: Memoize expensive computations
// Copy before sorting - Array.prototype.sort mutates in place
const sortedProducts = useMemo(() => {
  return [...products].sort((a, b) => a.price_cents - b.price_cents)
}, [products])

// PASS: GOOD: Memoize callbacks
const handleSearch = useCallback((query: string) => {
  setSearchQuery(query)
}, [])
```

### Lazy Loading

```typescript
import { lazy, Suspense } from 'react'

// PASS: GOOD: Lazy load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'))

export function Dashboard() {
  return (
    <Suspense fallback={<Spinner />}>
      <HeavyChart />
    </Suspense>
  )
}
```

### Database Queries

```typescript
// PASS: GOOD: Select only needed columns (Prisma, in apps/api only)
const skus = await prisma.sku.findMany({
  select: { sku_id: true, code: true, price_cents: true },
  take: 10,
})

// FAIL: BAD: Select everything
const skus = await prisma.sku.findMany()
```

## Testing Standards

### Test Structure (AAA Pattern)

```typescript
test('calculates installment total correctly', () => {
  // Arrange
  const totalCents = 12000
  const installments = 3

  // Act
  const installmentCents = calculateInstallmentTotal(totalCents, installments)

  // Assert
  expect(installmentCents).toBe(4000)
})
```

### Test Naming

```typescript
// PASS: GOOD: Descriptive test names
test('returns empty array when no SKUs match query', () => { })
test('throws error when the Vindi API key is missing', () => { })
test('falls back to MySQL full-text search when Meilisearch is unavailable', () => { })

// FAIL: BAD: Vague test names
test('works', () => { })
test('test search', () => { })
```

## Code Smell Detection

Watch for these anti-patterns:

### 1. Long Functions
```typescript
// FAIL: BAD: Function > 50 lines
function processOrderData() {
  // 100 lines of code
}

// PASS: GOOD: Split into smaller functions
function processOrderData() {
  const validated = validateData()
  const transformed = transformData(validated)
  return saveData(transformed)
}
```

### 2. Deep Nesting
```typescript
// FAIL: BAD: 5+ levels of nesting
if (user) {
  if (user.isAdmin) {
    if (order) {
      if (order.isPaid) {
        if (hasPermission) {
          // Do something
        }
      }
    }
  }
}

// PASS: GOOD: Early returns
if (!user) return
if (!user.isAdmin) return
if (!order) return
if (!order.isPaid) return
if (!hasPermission) return

// Do something
```

### 3. Magic Numbers
```typescript
// FAIL: BAD: Unexplained numbers
if (retryCount > 3) { }
setTimeout(callback, 500)

// PASS: GOOD: Named constants
const MAX_RETRIES = 3
const DEBOUNCE_DELAY_MS = 500

if (retryCount > MAX_RETRIES) { }
setTimeout(callback, DEBOUNCE_DELAY_MS)
```

**Remember**: Code quality is not negotiable. Clear, maintainable code enables rapid development and confident refactoring.
