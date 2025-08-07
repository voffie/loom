# The Complete Guide to Testing Effect TS with @effect/vitest

A comprehensive tutorial for testing Effect TypeScript applications using @effect/vitest, including property-based testing with fast-check and schema-driven test data generation.

## Table of Contents

1. [Introduction & Setup](#introduction--setup)
2. [Core Testing Concepts](#core-testing-concepts)
3. [Basic Testing Patterns](#basic-testing-patterns)
4. [Advanced Testing Features](#advanced-testing-features)
5. [Property-Based Testing Deep Dive](#property-based-testing-deep-dive)
6. [Schema-Based Testing](#schema-based-testing)
7. [Real-World Testing Scenarios](#real-world-testing-scenarios)
8. [Best Practices & Patterns](#best-practices--patterns)
9. [Complete Examples](#complete-examples)

---

## Introduction & Setup

### What is @effect/vitest?

`@effect/vitest` is a specialized testing framework that integrates Effect TS with Vitest, providing:

- **Effect-native testing**: Write tests that return Effects instead of void
- **Built-in TestServices**: Access to TestClock, TestAnnotations, TestConfig, etc.
- **Property-based testing**: Integration with fast-check for property testing
- **Schema integration**: Generate test data from Effect Schema definitions
- **Scope management**: Automatic resource cleanup in tests

### Installation

```bash
npm install --save-dev @effect/vitest vitest
# or
pnpm add -D @effect/vitest vitest
```

### Basic Vitest Configuration

Create or update your `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Optional: Configure test timeout for property tests
    testTimeout: 30000,
  },
})
```

### Initial Test Setup

```typescript
// test/setup.ts
import { describe, it } from '@effect/vitest'

// Export the enhanced testing utilities
export { describe, it }
```

---

## Core Testing Concepts

### The Effect Testing Model

Unlike traditional testing where functions return `void`, Effect tests return `Effect<A, E, R>`:

```typescript
import { Effect } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Effect Testing Basics', () => {
  // Traditional test (avoid in Effect code)
  it('traditional test', () => {
    expect(2 + 2).toBe(4)
  })

  // Effect test - returns an Effect
  it.effect('effect test', () =>
    Effect.gen(function* () {
      const result = yield* Effect.succeed(2 + 2)
      yield* Effect.sync(() => expect(result).toBe(4))
    })
  )
})
```

### TestServices Overview

TestServices provide specialized testing utilities:

```typescript
interface TestServices {
  TestAnnotations  // Test metadata and annotations
  TestLive        // Live service testing
  TestSized       // Size-based test generation
  TestConfig      // Test configuration
}
```

These services are automatically provided when using `it.effect` or `it.scoped`.

### Understanding Test Requirements

Different test methods provide different requirements (`R`):

- `it.effect`: Provides `TestServices`
- `it.scoped`: Provides `TestServices | Scope`
- `it.live`: Provides only your custom requirements
- `it.layer(someLayer)`: Provides `TestServices` + layer requirements

---

## Basic Testing Patterns

### it.effect vs it.scoped vs it.live

#### it.effect - Standard Effect Testing

Use `it.effect` for most Effect tests. It provides TestServices automatically:

```typescript
import { Effect, Random } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Basic Effect Tests', () => {
  it.effect('should generate random numbers', () =>
    Effect.gen(function* () {
      const num1 = yield* Random.nextInt
      const num2 = yield* Random.nextInt
      
      // Both should be valid integers
      yield* Effect.sync(() => {
        expect(Number.isInteger(num1)).toBe(true)
        expect(Number.isInteger(num2)).toBe(true)
      })
    })
  )

  it.effect('should handle errors properly', () =>
    Effect.gen(function* () {
      const result = yield* Effect.fail('test error').pipe(Effect.flip)
      yield* Effect.sync(() => expect(result).toBe('test error'))
    })
  )
})
```

#### it.scoped - Resource Management Testing

Use `it.scoped` when your test needs to manage resources (acquire/release pattern):

```typescript
import { Effect, Scope, Ref } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Scoped Resource Tests', () => {
  it.scoped('should manage resources properly', () =>
    Effect.gen(function* () {
      // Create a resource that tracks if it was released
      const wasReleased = yield* Ref.make(false)
      
      const resource = yield* Effect.acquireRelease(
        Effect.succeed('resource'),
        () => Ref.set(wasReleased, true)
      )
      
      yield* Effect.sync(() => expect(resource).toBe('resource'))
      
      // At test end, resource will be automatically released
      // In a real scenario, you'd test this differently
    })
  )
})
```

#### it.live - Live Service Testing

Use `it.live` when you need real implementations instead of test doubles:

```typescript
import { Effect, Console } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Live Service Tests', () => {
  it.live('should use real console', () =>
    Effect.gen(function* () {
      // This uses the actual console, not a test double
      yield* Console.log('This will actually print to console')
      yield* Effect.succeed(undefined)
    })
  )
})
```

### Testing Effect Services

```typescript
import { Effect, Context, Layer } from 'effect'
import { describe, it } from '@effect/vitest'

// Define a service
class Calculator extends Context.Tag('Calculator')<
  Calculator,
  {
    readonly add: (a: number, b: number) => Effect.Effect<number>
    readonly divide: (a: number, b: number) => Effect.Effect<number, string>
  }
>() {
  static readonly Test = Layer.succeed(Calculator, {
    add: (a, b) => Effect.succeed(a + b),
    divide: (a, b) => 
      b === 0 
        ? Effect.fail('Division by zero')
        : Effect.succeed(a / b)
  })
}

describe('Calculator Service', () => {
  it.layer(Calculator.Test)('should add numbers', () =>
    Effect.gen(function* () {
      const calc = yield* Calculator
      const result = yield* calc.add(2, 3)
      yield* Effect.sync(() => expect(result).toBe(5))
    })
  )

  it.layer(Calculator.Test)('should handle division by zero', () =>
    Effect.gen(function* () {
      const calc = yield* Calculator
      const error = yield* calc.divide(10, 0).pipe(Effect.flip)
      yield* Effect.sync(() => expect(error).toBe('Division by zero'))
    })
  )
})
```

---

## Advanced Testing Features

### Testing with TestClock

TestClock allows you to control time in tests without waiting:

```typescript
import { Effect, TestClock, Schedule } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Time-based Testing', () => {
  it.effect('should handle delays', () =>
    Effect.gen(function* () {
      // Start an effect that delays for 1 minute
      const delayedEffect = Effect.sleep('1 minute').pipe(
        Effect.as('completed'),
        Effect.fork
      )
      
      // Advance the test clock by 1 minute
      yield* TestClock.adjust('1 minute')
      
      // The effect should now be complete
      const fiber = yield* delayedEffect
      const result = yield* fiber.await
      
      yield* Effect.sync(() => expect(result).toBe('completed'))
    })
  )

  it.effect('should test recurring effects', () =>
    Effect.gen(function* () {
      const results: number[] = []
      
      // Start a recurring effect
      const recurring = Effect.sync(() => results.push(results.length + 1)).pipe(
        Effect.delay('30 minutes'),
        Effect.forever,
        Effect.fork
      )
      
      yield* recurring
      
      // Initially no results
      yield* Effect.sync(() => expect(results).toEqual([]))
      
      // After 30 minutes, should have 1 result
      yield* TestClock.adjust('30 minutes')
      yield* Effect.sync(() => expect(results).toEqual([1]))
      
      // After another 30 minutes, should have 2 results
      yield* TestClock.adjust('30 minutes')
      yield* Effect.sync(() => expect(results).toEqual([1, 2]))
    })
  )

  it.effect('should test timeouts', () =>
    Effect.gen(function* () {
      const slowEffect = Effect.sleep('5 minutes').pipe(
        Effect.as('slow result'),
        Effect.timeout('1 minute')
      )
      
      const fastFiber = yield* slowEffect.pipe(Effect.fork)
      
      // Advance by 1 minute (timeout threshold)
      yield* TestClock.adjust('1 minute')
      
      const result = yield* fastFiber.await
      yield* Effect.sync(() => expect(result).toBeUndefined())
    })
  )
})
```

### Using it.layer for Dependency Injection

```typescript
import { Effect, Context, Layer } from 'effect'
import { describe, it } from '@effect/vitest'

// Database service
class Database extends Context.Tag('Database')<
  Database,
  {
    readonly query: (sql: string) => Effect.Effect<any[]>
  }
>() {}

// User service that depends on Database
class UserService extends Context.Tag('UserService')<
  UserService,
  {
    readonly getUser: (id: string) => Effect.Effect<{ id: string; name: string }>
  }
>() {}

// Test implementations
const TestDatabase = Layer.succeed(Database, {
  query: (sql) => Effect.succeed([{ id: '1', name: 'John' }])
})

const TestUserService = Layer.succeed(UserService, {
  getUser: (id) => Effect.gen(function* () {
    const db = yield* Database
    const users = yield* db.query(`SELECT * FROM users WHERE id = ${id}`)
    return users[0] as { id: string; name: string }
  })
}).pipe(Layer.provide(TestDatabase))

describe('Layered Services', () => {
  it.layer(TestUserService)('should get user', () =>
    Effect.gen(function* () {
      const userService = yield* UserService
      const user = yield* userService.getUser('1')
      
      yield* Effect.sync(() => {
        expect(user).toEqual({ id: '1', name: 'John' })
      })
    })
  )
})
```

---

## Property-Based Testing Deep Dive

### Introduction to Property Testing

Property-based testing generates many test cases automatically and tests that properties hold across all inputs:

```typescript
import { Effect, Schema } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Property-Based Testing', () => {
  // Test that addition is commutative
  it.prop(
    'addition is commutative',
    [Schema.Number, Schema.Number],
    ([a, b]) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          expect(a + b).toBe(b + a)
        })
      })
  )
})
```

### Using FastCheck Arbitraries Directly

```typescript
import { FastCheck } from 'effect'
import { describe, it } from '@effect/vitest'

describe('FastCheck Arbitraries', () => {
  it.prop(
    'string operations',
    [FastCheck.string(), FastCheck.nat()],
    ([str, n]) =>
      Effect.gen(function* () {
        const repeated = str.repeat(n)
        
        yield* Effect.sync(() => {
          expect(repeated.length).toBe(str.length * n)
          if (n > 0) {
            expect(repeated.startsWith(str)).toBe(true)
          }
        })
      })
  )

  it.prop(
    'array operations',
    [FastCheck.array(FastCheck.integer())],
    ([arr]) =>
      Effect.gen(function* () {
        const sorted = [...arr].sort((a, b) => a - b)
        
        yield* Effect.sync(() => {
          expect(sorted.length).toBe(arr.length)
          // Test that array is actually sorted
          for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1])
          }
        })
      })
  )
})
```

### Using Effect Schema for Property Testing

Effect Schema provides a more structured approach to generating test data:

```typescript
import { Effect, Schema } from 'effect'
import { describe, it } from '@effect/vitest'

// Define domain schemas
const UserId = Schema.String.pipe(Schema.brand('UserId'))
const User = Schema.Struct({
  id: UserId,
  name: Schema.NonEmptyString,
  age: Schema.Int.pipe(Schema.between(0, 120)),
  email: Schema.String.pipe(Schema.pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
})

describe('Schema-based Property Testing', () => {
  it.prop(
    'user validation properties',
    [User],
    ([user]) =>
      Effect.gen(function* () {
        // Test that generated users are valid
        yield* Effect.sync(() => {
          expect(user.name.length).toBeGreaterThan(0)
          expect(user.age).toBeGreaterThanOrEqual(0)
          expect(user.age).toBeLessThanOrEqual(120)
          expect(user.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
        })
        
        // Test that user can be serialized and deserialized
        const encoded = yield* Schema.encode(User)(user)
        const decoded = yield* Schema.decode(User)(encoded)
        
        yield* Effect.sync(() => {
          expect(decoded).toEqual(user)
        })
      })
  )
})
```

### Configuring FastCheck Parameters

You can customize how property tests run:

```typescript
import { FastCheck } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Configured Property Tests', () => {
  it.prop(
    'custom configuration',
    [FastCheck.integer({ min: 1, max: 1000 })],
    ([n]) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          expect(n).toBeGreaterThan(0)
          expect(n).toBeLessThanOrEqual(1000)
        })
      }),
    {
      // Test configuration
      timeout: 10000,
      fastCheck: {
        numRuns: 1000,      // Run 1000 test cases
        maxSkipsPerRun: 100, // Allow up to 100 skips per run
        seed: 42,           // Fixed seed for reproducibility
        verbose: true       // Show shrinking process
      }
    }
  )
})
```

### Complex Property Testing Scenarios

```typescript
import { Effect, Array as EffectArray } from 'effect'
import { FastCheck } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Complex Property Tests', () => {
  it.prop(
    'list operations maintain invariants',
    [FastCheck.array(FastCheck.integer())],
    ([originalList]) =>
      Effect.gen(function* () {
        // Test various list operations
        const doubled = originalList.map(x => x * 2)
        const filtered = originalList.filter(x => x > 0)
        const sum = originalList.reduce((acc, x) => acc + x, 0)
        
        yield* Effect.sync(() => {
          // Doubled list has same length
          expect(doubled.length).toBe(originalList.length)
          
          // All doubled elements are actually doubled
          for (let i = 0; i < originalList.length; i++) {
            expect(doubled[i]).toBe(originalList[i] * 2)
          }
          
          // Filtered list contains only positive numbers
          expect(filtered.every(x => x > 0)).toBe(true)
          
          // Sum is correct
          expect(sum).toBe(originalList.reduce((acc, x) => acc + x, 0))
        })
      })
  )

  it.prop(
    'data structure properties',
    [
      FastCheck.record({
        name: FastCheck.string({ minLength: 1 }),
        values: FastCheck.array(FastCheck.float()),
        metadata: FastCheck.dictionary(
          FastCheck.string(),
          FastCheck.oneof(
            FastCheck.string(),
            FastCheck.integer(),
            FastCheck.boolean()
          )
        )
      })
    ],
    ([data]) =>
      Effect.gen(function* () {
        yield* Effect.sync(() => {
          // Test structural properties
          expect(data.name.length).toBeGreaterThan(0)
          expect(Array.isArray(data.values)).toBe(true)
          expect(typeof data.metadata).toBe('object')
          
          // Test that all values are numbers
          expect(data.values.every(v => typeof v === 'number')).toBe(true)
          
          // Test metadata values are of expected types
          Object.values(data.metadata).forEach(value => {
            expect(['string', 'number', 'boolean'].includes(typeof value)).toBe(true)
          })
        })
      })
  )
})
```

---

## Schema-Based Testing

### Generating Test Data from Schema

Effect Schema can automatically generate test data that conforms to your domain models:

```typescript
import { Effect, Schema, Arbitrary, FastCheck } from 'effect'
import { describe, it } from '@effect/vitest'

// Define comprehensive domain schemas
const ProductId = Schema.String.pipe(Schema.brand('ProductId'))
const Price = Schema.Number.pipe(Schema.positive(), Schema.brand('Price'))
const Quantity = Schema.Int.pipe(Schema.between(0, 10000), Schema.brand('Quantity'))

const Product = Schema.Struct({
  id: ProductId,
  name: Schema.NonEmptyString,
  price: Price,
  quantity: Quantity,
  tags: Schema.Array(Schema.String),
  metadata: Schema.Record({
    key: Schema.String,
    value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean)
  })
})

describe('Schema-Generated Test Data', () => {
  it.effect('should generate valid products', () =>
    Effect.gen(function* () {
      // Generate arbitrary products
      const productArbitrary = Arbitrary.make(Product)
      const products = FastCheck.sample(productArbitrary, 10)
      
      yield* Effect.sync(() => {
        products.forEach(product => {
          expect(product.name.length).toBeGreaterThan(0)
          expect(product.price).toBeGreaterThan(0)
          expect(product.quantity).toBeGreaterThanOrEqual(0)
          expect(product.quantity).toBeLessThanOrEqual(10000)
          expect(Array.isArray(product.tags)).toBe(true)
        })
      })
    })
  )
})
```

### Custom Arbitrary Generators

Customize how test data is generated for specific fields:

```typescript
import { Effect, Schema, Arbitrary, FastCheck } from 'effect'
import { describe, it } from '@effect/vitest'

// Custom email generator
const Email = Schema.String.annotations({
  arbitrary: () => (fc) =>
    fc.tuple(
      fc.stringMatching(/^[a-z]{3,10}$/),
      fc.constantFrom('gmail.com', 'yahoo.com', 'example.com')
    ).map(([name, domain]) => `${name}@${domain}`)
})

// Custom ID generator
const UserId = Schema.String.pipe(Schema.brand('UserId')).annotations({
  arbitrary: () => (fc) =>
    fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), {
      minLength: 8,
      maxLength: 8
    })
})

const User = Schema.Struct({
  id: UserId,
  email: Email,
  createdAt: Schema.DateTimeUtc,
  preferences: Schema.Struct({
    theme: Schema.Literal('light', 'dark'),
    notifications: Schema.Boolean,
    language: Schema.Literal('en', 'es', 'fr', 'de')
  })
})

describe('Custom Generators', () => {
  it.effect('should generate realistic user data', () =>
    Effect.gen(function* () {
      const userArbitrary = Arbitrary.make(User)
      const users = FastCheck.sample(userArbitrary, 5)
      
      yield* Effect.sync(() => {
        users.forEach(user => {
          // Test ID format
          expect(user.id).toMatch(/^\d{8}$/)
          
          // Test email format
          expect(user.email).toMatch(/^[a-z]{3,10}@(gmail\.com|yahoo\.com|example\.com)$/)
          
          // Test enum values
          expect(['light', 'dark']).toContain(user.preferences.theme)
          expect(['en', 'es', 'fr', 'de']).toContain(user.preferences.language)
          expect(typeof user.preferences.notifications).toBe('boolean')
        })
      })
    })
  )
})
```

### Integration with Faker.js

For even more realistic test data:

```typescript
import { Effect, Schema, Arbitrary, FastCheck } from 'effect'
import { faker } from '@faker-js/faker'
import { describe, it } from '@effect/vitest'

// Realistic name generator
const PersonName = Schema.String.annotations({
  arbitrary: () => (fc) =>
    fc.constant(null).map(() => faker.person.fullName())
})

// Realistic address generator
const Address = Schema.Struct({
  street: Schema.String.annotations({
    arbitrary: () => (fc) =>
      fc.constant(null).map(() => faker.location.streetAddress())
  }),
  city: Schema.String.annotations({
    arbitrary: () => (fc) =>
      fc.constant(null).map(() => faker.location.city())
  }),
  country: Schema.String.annotations({
    arbitrary: () => (fc) =>
      fc.constant(null).map(() => faker.location.country())
  }),
  zipCode: Schema.String.annotations({
    arbitrary: () => (fc) =>
      fc.constant(null).map(() => faker.location.zipCode())
  })
})

const Person = Schema.Struct({
  name: PersonName,
  address: Address,
  birthDate: Schema.Date.annotations({
    arbitrary: () => (fc) =>
      fc.constant(null).map(() => faker.date.birthdate())
  })
})

describe('Faker Integration', () => {
  it.effect('should generate realistic person data', () =>
    Effect.gen(function* () {
      const personArbitrary = Arbitrary.make(Person)
      const people = FastCheck.sample(personArbitrary, 3)
      
      yield* Effect.sync(() => {
        people.forEach(person => {
          expect(person.name).toBeTruthy()
          expect(person.address.street).toBeTruthy()
          expect(person.address.city).toBeTruthy()
          expect(person.address.country).toBeTruthy()
          expect(person.birthDate instanceof Date).toBe(true)
        })
      })
    })
  )
})
```

---

## Real-World Testing Scenarios

### Testing HTTP APIs

```typescript
import { Effect, Context, Layer, Schema } from 'effect'
import { describe, it } from '@effect/vitest'

// API Response schemas
const ApiUser = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String
})

const ApiError = Schema.Struct({
  message: Schema.String,
  code: Schema.Number
})

// HTTP Client service
class HttpClient extends Context.Tag('HttpClient')<
  HttpClient,
  {
    readonly get: (url: string) => Effect.Effect<unknown, ApiError>
    readonly post: (url: string, data: unknown) => Effect.Effect<unknown, ApiError>
  }
>() {}

// User API service
class UserApi extends Context.Tag('UserApi')<
  UserApi,
  {
    readonly getUser: (id: string) => Effect.Effect<ApiUser, ApiError>
    readonly createUser: (data: Omit<ApiUser, 'id'>) => Effect.Effect<ApiUser, ApiError>
  }
>() {}

// Test implementations
const TestHttpClient = Layer.succeed(HttpClient, {
  get: (url) => {
    if (url.includes('/users/123')) {
      return Effect.succeed({ id: '123', name: 'John', email: 'john@example.com' })
    }
    return Effect.fail({ message: 'Not found', code: 404 })
  },
  post: (url, data) => {
    if (url.includes('/users')) {
      return Effect.succeed({ 
        id: '456', 
        ...(data as Omit<ApiUser, 'id'>) 
      })
    }
    return Effect.fail({ message: 'Bad request', code: 400 })
  }
})

const TestUserApi = Layer.succeed(UserApi, {
  getUser: (id) => Effect.gen(function* () {
    const http = yield* HttpClient
    const response = yield* http.get(`/users/${id}`)
    return yield* Schema.decode(ApiUser)(response)
  }),
  createUser: (data) => Effect.gen(function* () {
    const http = yield* HttpClient
    const response = yield* http.post('/users', data)
    return yield* Schema.decode(ApiUser)(response)
  })
}).pipe(Layer.provide(TestHttpClient))

describe('HTTP API Testing', () => {
  it.layer(TestUserApi)('should get user successfully', () =>
    Effect.gen(function* () {
      const userApi = yield* UserApi
      const user = yield* userApi.getUser('123')
      
      yield* Effect.sync(() => {
        expect(user.id).toBe('123')
        expect(user.name).toBe('John')
        expect(user.email).toBe('john@example.com')
      })
    })
  )

  it.layer(TestUserApi)('should handle user not found', () =>
    Effect.gen(function* () {
      const userApi = yield* UserApi
      const error = yield* userApi.getUser('999').pipe(Effect.flip)
      
      yield* Effect.sync(() => {
        expect(error.code).toBe(404)
        expect(error.message).toBe('Not found')
      })
    })
  )

  it.layer(TestUserApi)('should create user', () =>
    Effect.gen(function* () {
      const userApi = yield* UserApi
      const newUser = yield* userApi.createUser({
        name: 'Jane',
        email: 'jane@example.com'
      })
      
      yield* Effect.sync(() => {
        expect(newUser.id).toBe('456')
        expect(newUser.name).toBe('Jane')
        expect(newUser.email).toBe('jane@example.com')
      })
    })
  )
})
```

### Testing Database Operations

```typescript
import { Effect, Context, Layer, Array as EffectArray } from 'effect'
import { describe, it } from '@effect/vitest'

// Database models
interface User {
  id: string
  name: string
  email: string
}

// Database service
class Database extends Context.Tag('Database')<
  Database,
  {
    readonly findUser: (id: string) => Effect.Effect<User | null>
    readonly findUsers: (ids: string[]) => Effect.Effect<User[]>
    readonly saveUser: (user: User) => Effect.Effect<User>
    readonly deleteUser: (id: string) => Effect.Effect<boolean>
  }
>() {}

// Test database implementation using in-memory storage
const TestDatabase = Layer.sync(Database, () => {
  const users = new Map<string, User>([
    ['1', { id: '1', name: 'Alice', email: 'alice@example.com' }],
    ['2', { id: '2', name: 'Bob', email: 'bob@example.com' }]
  ])

  return {
    findUser: (id) => Effect.succeed(users.get(id) ?? null),
    findUsers: (ids) => Effect.succeed(
      ids.map(id => users.get(id)).filter((user): user is User => user !== undefined)
    ),
    saveUser: (user) => Effect.sync(() => {
      users.set(user.id, user)
      return user
    }),
    deleteUser: (id) => Effect.sync(() => {
      const existed = users.has(id)
      users.delete(id)
      return existed
    })
  }
})

describe('Database Operations', () => {
  it.layer(TestDatabase)('should find existing user', () =>
    Effect.gen(function* () {
      const db = yield* Database
      const user = yield* db.findUser('1')
      
      yield* Effect.sync(() => {
        expect(user).not.toBeNull()
        expect(user!.name).toBe('Alice')
        expect(user!.email).toBe('alice@example.com')
      })
    })
  )

  it.layer(TestDatabase)('should return null for non-existent user', () =>
    Effect.gen(function* () {
      const db = yield* Database
      const user = yield* db.findUser('999')
      
      yield* Effect.sync(() => {
        expect(user).toBeNull()
      })
    })
  )

  it.layer(TestDatabase)('should save and retrieve user', () =>
    Effect.gen(function* () {
      const db = yield* Database
      const newUser = { id: '3', name: 'Charlie', email: 'charlie@example.com' }
      
      const saved = yield* db.saveUser(newUser)
      const retrieved = yield* db.findUser('3')
      
      yield* Effect.sync(() => {
        expect(saved).toEqual(newUser)
        expect(retrieved).toEqual(newUser)
      })
    })
  )

  it.layer(TestDatabase)('should find multiple users', () =>
    Effect.gen(function* () {
      const db = yield* Database
      const users = yield* db.findUsers(['1', '2', '999'])
      
      yield* Effect.sync(() => {
        expect(users).toHaveLength(2)
        expect(users.map(u => u.id)).toEqual(['1', '2'])
      })
    })
  )
})
```

### Testing Concurrent Operations

```typescript
import { Effect, Fiber, Queue, Ref } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Concurrent Operations', () => {
  it.effect('should handle concurrent queue operations', () =>
    Effect.gen(function* () {
      const queue = yield* Queue.bounded<number>(10)
      
      // Producer fiber
      const producer = Effect.gen(function* () {
        for (let i = 0; i < 5; i++) {
          yield* Queue.offer(queue, i)
          yield* Effect.sleep('10 millis')
        }
      }).pipe(Effect.fork)
      
      // Consumer fiber
      const consumer = Effect.gen(function* () {
        const results: number[] = []
        for (let i = 0; i < 5; i++) {
          const item = yield* Queue.take(queue)
          results.push(item)
        }
        return results
      }).pipe(Effect.fork)
      
      const [producerFiber, consumerFiber] = yield* Effect.all([producer, consumer])
      
      // Wait for both to complete
      yield* Fiber.join(producerFiber)
      const results = yield* Fiber.join(consumerFiber)
      
      yield* Effect.sync(() => {
        expect(results).toEqual([0, 1, 2, 3, 4])
      })
    })
  )

  it.effect('should handle concurrent ref updates', () =>
    Effect.gen(function* () {
      const counter = yield* Ref.make(0)
      
      // Create multiple fibers that increment the counter
      const fibers = yield* Effect.all(
        Array.from({ length: 10 }, (_, i) =>
          Effect.gen(function* () {
            for (let j = 0; j < 10; j++) {
              yield* Ref.update(counter, n => n + 1)
            }
          }).pipe(Effect.fork)
        )
      )
      
      // Wait for all fibers to complete
      yield* Effect.all(fibers.map(Fiber.join))
      
      const finalValue = yield* Ref.get(counter)
      
      yield* Effect.sync(() => {
        expect(finalValue).toBe(100)
      })
    })
  )
})
```

---

## Best Practices & Patterns

### Test Organization

```typescript
import { Effect } from 'effect'
import { describe, it } from '@effect/vitest'

// Group related tests
describe('User Management', () => {
  describe('User Creation', () => {
    it.effect('should create user with valid data', () => {
      // Test implementation
    })
    
    it.effect('should reject user with invalid email', () => {
      // Test implementation
    })
  })
  
  describe('User Retrieval', () => {
    it.effect('should find user by id', () => {
      // Test implementation
    })
    
    it.effect('should return null for non-existent user', () => {
      // Test implementation
    })
  })
})
```

### Error Testing Patterns

```typescript
import { Effect, Schema } from 'effect'
import { describe, it } from '@effect/vitest'

class ValidationError extends Schema.TaggedError<ValidationError>('ValidationError')({
  field: Schema.String,
  reason: Schema.String
}) {}

const validateUser = (data: unknown): Effect.Effect<User, ValidationError> => {
  // Validation logic here
  return Effect.fail(new ValidationError({ field: 'email', reason: 'Invalid format' }))
}

describe('Error Handling', () => {
  // Test specific error types
  it.effect('should fail with ValidationError for invalid email', () =>
    Effect.gen(function* () {
      const result = yield* validateUser({ email: 'invalid' }).pipe(Effect.flip)
      
      yield* Effect.sync(() => {
        expect(result._tag).toBe('ValidationError')
        expect(result.field).toBe('email')
        expect(result.reason).toBe('Invalid format')
      })
    })
  )

  // Test error recovery
  it.effect('should recover from validation errors', () =>
    Effect.gen(function* () {
      const result = yield* validateUser({ email: 'invalid' }).pipe(
        Effect.catchTag('ValidationError', () => Effect.succeed(null))
      )
      
      yield* Effect.sync(() => {
        expect(result).toBeNull()
      })
    })
  )
})
```

### Performance Testing

```typescript
import { Effect, TestClock, Fiber } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Performance Tests', () => {
  it.effect('should complete within time limit', () =>
    Effect.gen(function* () {
      const startTime = yield* TestClock.currentTimeMillis
      
      // Simulate some work
      const work = Effect.gen(function* () {
        yield* Effect.sleep('100 millis')
        return 'completed'
      }).pipe(Effect.fork)
      
      yield* TestClock.adjust('100 millis')
      const result = yield* Fiber.join(work)
      
      const endTime = yield* TestClock.currentTimeMillis
      const duration = endTime - startTime
      
      yield* Effect.sync(() => {
        expect(result).toBe('completed')
        expect(duration).toBeLessThanOrEqual(100)
      })
    })
  )
})
```

### Property Test Design Guidelines

```typescript
import { FastCheck } from 'effect'
import { describe, it } from '@effect/vitest'

describe('Property Test Guidelines', () => {
  // 1. Test invariants that should always hold
  it.prop(
    'reverse is involutive (reverse(reverse(x)) === x)',
    [FastCheck.array(FastCheck.integer())],
    ([arr]) =>
      Effect.gen(function* () {
        const reversed = arr.slice().reverse()
        const doubleReversed = reversed.slice().reverse()
        
        yield* Effect.sync(() => {
          expect(doubleReversed).toEqual(arr)
        })
      })
  )

  // 2. Test relationship between operations
  it.prop(
    'map then filter === filter then map (when filter is independent of map)',
    [FastCheck.array(FastCheck.integer())],
    ([arr]) =>
      Effect.gen(function* () {
        const mapThenFilter = arr.map(x => x * 2).filter(x => x > 0)
        const filterThenMap = arr.filter(x => x > 0).map(x => x * 2)
        
        yield* Effect.sync(() => {
          expect(mapThenFilter).toEqual(filterThenMap)
        })
      })
  )

  // 3. Test round-trip properties
  it.prop(
    'encode then decode is identity',
    [FastCheck.string()],
    ([str]) =>
      Effect.gen(function* () {
        const encoded = btoa(str)
        const decoded = atob(encoded)
        
        yield* Effect.sync(() => {
          expect(decoded).toBe(str)
        })
      })
  )
})
```

### Common Pitfalls and Solutions

#### Pitfall 1: Not Using Effect Utilities

```typescript
// ❌ Don't do this - mixing Effect and non-Effect code
it.effect('bad example', () =>
  Effect.gen(function* () {
    const result = yield* someEffect()
    expect(result).toBe('expected') // Direct expect call
  })
)

// ✅ Do this - wrap assertions in Effect
it.effect('good example', () =>
  Effect.gen(function* () {
    const result = yield* someEffect()
    yield* Effect.sync(() => {
      expect(result).toBe('expected')
    })
  })
)
```

#### Pitfall 2: Forgetting to Handle Errors

```typescript
// ❌ Don't do this - errors might not be caught
it.effect('bad error test', () =>
  Effect.gen(function* () {
    const result = yield* dangerousEffect()
    // Test never reaches here if effect fails
  })
)

// ✅ Do this - explicitly test for errors
it.effect('good error test', () =>
  Effect.gen(function* () {
    const result = yield* dangerousEffect().pipe(Effect.either)
    
    yield* Effect.sync(() => {
      if (result._tag === 'Left') {
        expect(result.left).toBeInstanceOf(SomeError)
      } else {
        expect(result.right).toBe('expected')
      }
    })
  })
)
```

#### Pitfall 3: Not Using Proper Test Method

```typescript
// ❌ Don't do this - using wrong test method
it('should test resource management', () => {
  // Can't properly test resource cleanup
})

// ✅ Do this - use appropriate test method
it.scoped('should test resource management', () =>
  Effect.gen(function* () {
    const resource = yield* acquireResource()
    // Resource will be properly cleaned up
  })
)
```

---

## Complete Examples

### E-commerce System Testing

```typescript
import { Effect, Context, Layer, Schema, Array as EffectArray } from 'effect'
import { describe, it } from '@effect/vitest'

// Domain Models
const ProductId = Schema.String.pipe(Schema.brand('ProductId'))
const UserId = Schema.String.pipe(Schema.brand('UserId'))
const OrderId = Schema.String.pipe(Schema.brand('OrderId'))

const Product = Schema.Struct({
  id: ProductId,
  name: Schema.String,
  price: Schema.Number.pipe(Schema.positive()),
  stock: Schema.Int.pipe(Schema.between(0, 10000))
})

const OrderItem = Schema.Struct({
  productId: ProductId,
  quantity: Schema.Int.pipe(Schema.positive()),
  price: Schema.Number.pipe(Schema.positive())
})

const Order = Schema.Struct({
  id: OrderId,
  userId: UserId,
  items: Schema.Array(OrderItem),
  total: Schema.Number.pipe(Schema.positive()),
  status: Schema.Literal('pending', 'confirmed', 'shipped', 'delivered')
})

// Services
class ProductService extends Context.Tag('ProductService')<
  ProductService,
  {
    readonly findProduct: (id: ProductId) => Effect.Effect<Product | null>
    readonly updateStock: (id: ProductId, quantity: number) => Effect.Effect<void>
  }
>() {}

class OrderService extends Context.Tag('OrderService')<
  OrderService,
  {
    readonly createOrder: (userId: UserId, items: OrderItem[]) => Effect.Effect<Order>
    readonly processOrder: (id: OrderId) => Effect.Effect<Order>
  }
>() {}

// Test implementations
const TestProductService = Layer.succeed(ProductService, {
  findProduct: (id) => {
    const products = new Map([
      ['1' as ProductId, { id: '1' as ProductId, name: 'Laptop', price: 999.99, stock: 5 }],
      ['2' as ProductId, { id: '2' as ProductId, name: 'Mouse', price: 29.99, stock: 100 }]
    ])
    return Effect.succeed(products.get(id) ?? null)
  },
  updateStock: (id, quantity) => Effect.succeed(undefined)
})

const TestOrderService = Layer.succeed(OrderService, {
  createOrder: (userId, items) => Effect.gen(function* () {
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    return {
      id: 'order-123' as OrderId,
      userId,
      items,
      total,
      status: 'pending' as const
    }
  }),
  processOrder: (id) => Effect.succeed({
    id,
    userId: 'user-1' as UserId,
    items: [],
    total: 0,
    status: 'confirmed' as const
  })
}).pipe(Layer.provide(TestProductService))

const TestServices = Layer.mergeAll(TestProductService, TestOrderService)

describe('E-commerce System', () => {
  it.layer(TestServices)('should create order with valid items', () =>
    Effect.gen(function* () {
      const orderService = yield* OrderService
      
      const items: OrderItem[] = [
        { productId: '1' as ProductId, quantity: 1, price: 999.99 },
        { productId: '2' as ProductId, quantity: 2, price: 29.99 }
      ]
      
      const order = yield* orderService.createOrder('user-1' as UserId, items)
      
      yield* Effect.sync(() => {
        expect(order.userId).toBe('user-1')
        expect(order.items).toHaveLength(2)
        expect(order.total).toBe(1059.97) // 999.99 + (29.99 * 2)
        expect(order.status).toBe('pending')
      })
    })
  )

  it.layer(TestServices)('should process order successfully', () =>
    Effect.gen(function* () {
      const orderService = yield* OrderService
      const order = yield* orderService.processOrder('order-123' as OrderId)
      
      yield* Effect.sync(() => {
        expect(order.status).toBe('confirmed')
      })
    })
  )

  // Property test for order calculations
  it.prop(
    'order total should equal sum of item totals',
    [
      Schema.Array(OrderItem).pipe(Schema.minItems(1), Schema.maxItems(10))
    ],
    ([items]) =>
      Effect.gen(function* () {
        const expectedTotal = items.reduce(
          (sum, item) => sum + (item.price * item.quantity), 
          0
        )
        
        const orderService = yield* OrderService
        const order = yield* orderService.createOrder('user-test' as UserId, items)
        
        yield* Effect.sync(() => {
          expect(order.total).toBeCloseTo(expectedTotal, 2)
        })
      })
  )
})
```

### Event Sourcing System Testing

```typescript
import { Effect, Context, Layer, Array as EffectArray, Ref } from 'effect'
import { describe, it } from '@effect/vitest'

// Events
interface UserCreated {
  type: 'UserCreated'
  userId: string
  name: string
  email: string
  timestamp: Date
}

interface UserEmailChanged {
  type: 'UserEmailChanged'
  userId: string
  newEmail: string
  timestamp: Date
}

type UserEvent = UserCreated | UserEmailChanged

// Aggregate
interface UserAggregate {
  id: string
  name: string
  email: string
  version: number
}

// Event Store
class EventStore extends Context.Tag('EventStore')<
  EventStore,
  {
    readonly appendEvents: (streamId: string, events: UserEvent[]) => Effect.Effect<void>
    readonly getEvents: (streamId: string) => Effect.Effect<UserEvent[]>
  }
>() {}

// User Service
class UserService extends Context.Tag('UserService')<
  UserService,
  {
    readonly createUser: (id: string, name: string, email: string) => Effect.Effect<void>
    readonly changeEmail: (id: string, newEmail: string) => Effect.Effect<void>
    readonly getUser: (id: string) => Effect.Effect<UserAggregate | null>
  }
>() {}

// Test Event Store
const TestEventStore = Layer.sync(EventStore, () => {
  const events = new Map<string, UserEvent[]>()
  
  return {
    appendEvents: (streamId, newEvents) => Effect.sync(() => {
      const existing = events.get(streamId) ?? []
      events.set(streamId, [...existing, ...newEvents])
    }),
    getEvents: (streamId) => Effect.succeed(events.get(streamId) ?? [])
  }
})

// User Service Implementation
const UserServiceImpl = Layer.effect(UserService, 
  Effect.gen(function* () {
    const eventStore = yield* EventStore
    
    const buildAggregate = (events: UserEvent[]): UserAggregate | null => {
      if (events.length === 0) return null
      
      let aggregate: UserAggregate | null = null
      
      for (const event of events) {
        switch (event.type) {
          case 'UserCreated':
            aggregate = {
              id: event.userId,
              name: event.name,
              email: event.email,
              version: 1
            }
            break
          case 'UserEmailChanged':
            if (aggregate) {
              aggregate.email = event.newEmail
              aggregate.version++
            }
            break
        }
      }
      
      return aggregate
    }
    
    return {
      createUser: (id, name, email) => {
        const event: UserCreated = {
          type: 'UserCreated',
          userId: id,
          name,
          email,
          timestamp: new Date()
        }
        return eventStore.appendEvents(id, [event])
      },
      
      changeEmail: (id, newEmail) => {
        const event: UserEmailChanged = {
          type: 'UserEmailChanged',
          userId: id,
          newEmail,
          timestamp: new Date()
        }
        return eventStore.appendEvents(id, [event])
      },
      
      getUser: (id) => Effect.gen(function* () {
        const events = yield* eventStore.getEvents(id)
        return buildAggregate(events)
      })
    }
  })
).pipe(Layer.provide(TestEventStore))

describe('Event Sourcing System', () => {
  it.layer(UserServiceImpl)('should create and retrieve user', () =>
    Effect.gen(function* () {
      const userService = yield* UserService
      
      yield* userService.createUser('user-1', 'John Doe', 'john@example.com')
      const user = yield* userService.getUser('user-1')
      
      yield* Effect.sync(() => {
        expect(user).not.toBeNull()
        expect(user!.id).toBe('user-1')
        expect(user!.name).toBe('John Doe')
        expect(user!.email).toBe('john@example.com')
        expect(user!.version).toBe(1)
      })
    })
  )

  it.layer(UserServiceImpl)('should handle email changes', () =>
    Effect.gen(function* () {
      const userService = yield* UserService
      
      yield* userService.createUser('user-2', 'Jane Doe', 'jane@example.com')
      yield* userService.changeEmail('user-2', 'jane.doe@example.com')
      
      const user = yield* userService.getUser('user-2')
      
      yield* Effect.sync(() => {
        expect(user!.email).toBe('jane.doe@example.com')
        expect(user!.version).toBe(2)
      })
    })
  )

  it.layer(UserServiceImpl)('should return null for non-existent user', () =>
    Effect.gen(function* () {
      const userService = yield* UserService
      const user = yield* userService.getUser('non-existent')
      
      yield* Effect.sync(() => {
        expect(user).toBeNull()
      })
    })
  )
})
```

---

## Conclusion

This comprehensive guide covers all aspects of testing Effect TS applications with `@effect/vitest`. Key takeaways:

1. **Use the right test method**: `it.effect` for most tests, `it.scoped` for resource management, `it.live` for real implementations
2. **Leverage property-based testing**: Use `it.prop` with FastCheck or Schema for comprehensive test coverage
3. **Generate realistic test data**: Combine Schema with custom arbitraries and faker.js
4. **Test time-dependent code**: Use TestClock to control time in tests
5. **Structure your tests**: Organize tests logically and use appropriate layers for dependencies
6. **Handle errors explicitly**: Test both success and failure cases
7. **Follow Effect patterns**: Use Effect utilities consistently throughout your tests

The combination of Effect's type safety, Vitest's performance, and fast-check's property testing provides a powerful foundation for building robust, well-tested applications.