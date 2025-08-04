import { Effect, Schema } from 'effect'
import { describe, it, expect, TEST_CONFIG } from '../setup'
import { LoomConfigSchema, LoomConfigEntrySchema } from '../../types'
import {
  LoomConfigArbitrary,
  LoomConfigEntryArbitrary,
  TargetPathArbitrary,
  GitHubRepoArbitrary,
  InvalidGitHubRepoArbitrary,
  createRealisticConfig,
  configToTOML
} from '../fixtures/schemas'
import * as TOML from '@iarna/toml'

describe('Types and Schema Validation', () => {
  describe('LoomConfigEntrySchema', () => {
    it.effect('should validate valid config entries', () =>
      Effect.gen(function* () {
        const validEntry = {
          target: '/test-home/.config/nvim'
        }

        const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(validEntry)
        
        yield* Effect.sync(() => {
          expect(result.target).toBe('/test-home/.config/nvim')
          expect(result.source).toBeUndefined()
        })
      })
    )

    it.effect('should validate config entries with source', () =>
      Effect.gen(function* () {
        const validEntry = {
          source: 'craftzdog/dotfiles-public',
          target: '/test-home/.config/nvim'
        }

        const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(validEntry)
        
        yield* Effect.sync(() => {
          expect(result.target).toBe('/test-home/.config/nvim')
          expect(result.source).toBe('craftzdog/dotfiles-public')
        })
      })
    )

    it.effect('should reject entries without target', () =>
      Effect.gen(function* () {
        const invalidEntry = {
          source: 'craftzdog/dotfiles-public'
        }

        const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(invalidEntry).pipe(
          Effect.either
        )
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
        })
      })
    )

    it.prop(
      'should validate all generated config entries',
      [LoomConfigEntryArbitrary],
      ([entry]) =>
        Effect.gen(function* () {
          const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(entry)
          
          yield* Effect.sync(() => {
            expect(typeof result.target).toBe('string')
            expect(result.target.length).toBeGreaterThan(0)
            if (result.source) {
              expect(typeof result.source).toBe('string')
              expect(result.source.length).toBeGreaterThan(0)
            }
          })
        }),
      { timeout: TEST_CONFIG.timeout, fastCheck: TEST_CONFIG.fastCheck }
    )
  })

  describe('LoomConfigSchema', () => {
    it.effect('should validate empty config', () =>
      Effect.gen(function* () {
        const emptyConfig = {}

        const result = yield* Schema.decodeUnknown(LoomConfigSchema)(emptyConfig)
        
        yield* Effect.sync(() => {
          expect(Object.keys(result)).toHaveLength(0)
        })
      })
    )

    it.effect('should validate realistic config structures', () =>
      Effect.gen(function* () {
        const config = createRealisticConfig(3)

        const result = yield* Schema.decodeUnknown(LoomConfigSchema)(config)
        
        yield* Effect.sync(() => {
          expect(Object.keys(result)).toHaveLength(3)
          Object.values(result).forEach(entry => {
            expect(typeof entry.target).toBe('string')
            expect(entry.target.startsWith('/')).toBe(true)
          })
        })
      })
    )

    it.prop(
      'should validate all generated configs',
      [LoomConfigArbitrary],
      ([config]) =>
        Effect.gen(function* () {
          const result = yield* Schema.decodeUnknown(LoomConfigSchema)(config)
          
          yield* Effect.sync(() => {
            expect(typeof result).toBe('object')
            Object.entries(result).forEach(([name, entry]) => {
              expect(typeof name).toBe('string')
              expect(name.length).toBeGreaterThan(0)
              expect(typeof entry.target).toBe('string')
              expect(entry.target.length).toBeGreaterThan(0)
            })
          })
        }),
      { timeout: TEST_CONFIG.timeout, fastCheck: TEST_CONFIG.fastCheck }
    )
  })

  describe('Schema Roundtrip Properties', () => {
    it.prop(
      'config entry encode/decode roundtrip',
      [LoomConfigEntryArbitrary],
      ([entry]) =>
        Effect.gen(function* () {
          const encoded = yield* Schema.encode(LoomConfigEntrySchema)(entry)
          const decoded = yield* Schema.decode(LoomConfigEntrySchema)(encoded)
          
          yield* Effect.sync(() => {
            expect(decoded).toEqual(entry)
          })
        }),
      { timeout: TEST_CONFIG.timeout, fastCheck: TEST_CONFIG.fastCheck }
    )

    it.prop(
      'full config encode/decode roundtrip',
      [LoomConfigArbitrary],
      ([config]) =>
        Effect.gen(function* () {
          const encoded = yield* Schema.encode(LoomConfigSchema)(config)
          const decoded = yield* Schema.decode(LoomConfigSchema)(encoded)
          
          yield* Effect.sync(() => {
            expect(decoded).toEqual(config)
          })
        }),
      { timeout: TEST_CONFIG.timeout, fastCheck: TEST_CONFIG.fastCheck }
    )
  })

  describe('TOML Integration', () => {
    it.effect('should handle TOML serialization/deserialization', () =>
      Effect.gen(function* () {
        const config = createRealisticConfig(2)
        const tomlString = configToTOML(config)
        
        // Parse TOML and validate with schema
        const parsed = TOML.parse(tomlString)
        const validated = yield* Schema.decodeUnknown(LoomConfigSchema)(parsed)
        
        yield* Effect.sync(() => {
          expect(validated).toEqual(config)
        })
      })
    )

    it.prop(
      'TOML roundtrip preserves config structure',
      [LoomConfigArbitrary],
      ([config]) =>
        Effect.gen(function* () {
          // Skip empty configs as they don't roundtrip through TOML meaningfully
          if (Object.keys(config).length === 0) {
            return yield* Effect.void
          }
          
          const tomlString = configToTOML(config)
          const parsed = TOML.parse(tomlString)
          const validated = yield* Schema.decodeUnknown(LoomConfigSchema)(parsed)
          
          yield* Effect.sync(() => {
            expect(validated).toEqual(config)
          })
        }),
      { 
        timeout: TEST_CONFIG.timeout, 
        fastCheck: { 
          ...TEST_CONFIG.fastCheck,
          numRuns: 50 // Reduce runs for TOML tests as they're slower
        }
      }
    )

    it.effect('should reject malformed TOML', () =>
      Effect.gen(function* () {
        const malformedToml = `
          [nvim
          target = "/test-home/.config/nvim"
          
          [tmux]
          target = missing quotes
        `
        
        const parseResult = yield* Effect.try(() => TOML.parse(malformedToml)).pipe(
          Effect.either
        )
        
        yield* Effect.sync(() => {
          expect(parseResult._tag).toBe('Left')
        })
      })
    )
  })

  describe('Input Validation', () => {
    it.effect('should reject invalid data types', () =>
      Effect.gen(function* () {
        const invalidInputs = [
          null,
          undefined,
          'string',
          42,
          [],
          { target: null },
          { target: 42 },
          { source: 123, target: '/path' }
        ]

        for (const input of invalidInputs) {
          const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(input).pipe(
            Effect.either
          )
          
          yield* Effect.sync(() => {
            expect(result._tag).toBe('Left')
          })
        }
      })
    )

    it.prop(
      'should validate target path requirements',
      [TargetPathArbitrary],
      ([targetPath]) =>
        Effect.gen(function* () {
          const entry = { target: targetPath }
          const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(entry)
          
          yield* Effect.sync(() => {
            expect(result.target).toBe(targetPath)
            expect(typeof result.target).toBe('string')
            expect(result.target.length).toBeGreaterThan(0)
          })
        }),
      { timeout: TEST_CONFIG.timeout, fastCheck: TEST_CONFIG.fastCheck }
    )

    it.prop(
      'should validate optional source field',
      [GitHubRepoArbitrary],
      ([source]) =>
        Effect.gen(function* () {
          const entry = { 
            source, 
            target: '/test-home/.config/test'
          }
          const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(entry)
          
          yield* Effect.sync(() => {
            expect(result.source).toBe(source)
            expect(result.target).toBe('/test-home/.config/test')
          })
        }),
      { timeout: TEST_CONFIG.timeout, fastCheck: TEST_CONFIG.fastCheck }
    )
  })

  describe('Error Handling', () => {
    it.effect('should provide meaningful error messages', () =>
      Effect.gen(function* () {
        const invalidEntry = { source: 'valid', target: 123 }

        const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(invalidEntry).pipe(
          Effect.flip
        )
        
        yield* Effect.sync(() => {
          expect(result.message).toContain('target')
        })
      })
    )

    it.effect('should handle nested validation errors', () =>
      Effect.gen(function* () {
        const invalidConfig = {
          validEntry: { target: '/valid/path' },
          invalidEntry: { target: null }
        }

        const result = yield* Schema.decodeUnknown(LoomConfigSchema)(invalidConfig).pipe(
          Effect.flip
        )
        
        yield* Effect.sync(() => {
          expect(result.message).toBeTruthy()
        })
      })
    )
  })

  describe('Edge Cases', () => {
    it.effect('should handle empty strings', () =>
      Effect.gen(function* () {
        const entry = { target: '' }

        const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(entry)
        
        yield* Effect.sync(() => {
          expect(result.target).toBe('')
        })
      })
    )

    it.effect('should handle special characters in paths', () =>
      Effect.gen(function* () {
        const specialPaths = [
          '/test-home/.config/app-name',
          '/test-home/.config/app_name',
          '/test-home/.config/app.name',
          '/test-home/.app-with-dashes',
          '/test-home/.app_with_underscores'
        ]

        for (const target of specialPaths) {
          const entry = { target }
          const result = yield* Schema.decodeUnknown(LoomConfigEntrySchema)(entry)
          
          yield* Effect.sync(() => {
            expect(result.target).toBe(target)
          })
        }
      })
    )

    it.effect('should handle large config structures', () =>
      Effect.gen(function* () {
        const largeConfig = createRealisticConfig(50)

        const result = yield* Schema.decodeUnknown(LoomConfigSchema)(largeConfig)
        
        yield* Effect.sync(() => {
          expect(Object.keys(result)).toHaveLength(50)
        })
      })
    )
  })
})