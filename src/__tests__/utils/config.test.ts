import { Effect, Either } from 'effect'
import { describe, it, expect, TestServices, TEST_CONFIG_PATH, MockFileSystemService, MockPromptService } from '../setup'
import { readConfig, writeEntry, removeEntry } from '../../utils/config'
import { 
  createRealisticConfig, 
  configToTOML 
} from '../fixtures/schemas'

describe('Config Utils', () => {
  describe('readConfig', () => {
    it.layer(TestServices)('should read valid TOML config', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const config = createRealisticConfig(2)
        const tomlContent = configToTOML(config)
        
        // Setup mock file system
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        
        const result = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(result).toEqual(config)
        })
      })
    )

    it.layer(TestServices)('should handle empty config file', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        
        // Setup empty config
        yield* mockFs.writeFile(TEST_CONFIG_PATH, '')
        
        const result = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(Object.keys(result)).toHaveLength(0)
        })
      })
    )

    it.layer(TestServices)('should fail when config file does not exist', () =>
      Effect.gen(function* () {
        const result = yield* readConfig().pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('ReadFileError')
            // @ts-expect-error - The error structure from the actual implementation may differ slightly
            expect(result.left.path).toBe(TEST_CONFIG_PATH)
          }
        })
      })
    )

    it.layer(TestServices)('should fail on malformed TOML', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const malformedToml = `
          [nvim
          target = "/test-home/.config/nvim"
        `
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, malformedToml)
        
        const result = yield* readConfig().pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
        })
      })
    )
  })

  describe('writeEntry', () => {
    it.layer(TestServices)('should add new local entry', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = createRealisticConfig(1)
        const tomlContent = configToTOML(initialConfig)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        
        yield* writeEntry('/local/path', 'newapp', true)
        
        // Read the updated config
        const updatedConfig = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(updatedConfig.newapp).toBeDefined()
          expect(updatedConfig.newapp?.target).toBe('/test-home/.config/newapp')
          expect(updatedConfig.newapp?.source).toBeUndefined()
        })
      })
    )

    it.layer(TestServices)('should add new git entry', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = createRealisticConfig(1)
        const tomlContent = configToTOML(initialConfig)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        
        yield* writeEntry('user/repo', 'newapp', false)
        
        const updatedConfig = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(updatedConfig.newapp).toBeDefined()
          expect(updatedConfig.newapp?.target).toBe('/test-home/.config/newapp')
          expect(updatedConfig.newapp?.source).toBe('user/repo')
        })
      })
    )

    it.layer(TestServices)('should handle user override choice', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const mockPrompt = yield* MockPromptService
        
        const initialConfig = { nvim: { target: '/test-home/.config/nvim' } }
        const tomlContent = configToTOML(initialConfig)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        yield* mockPrompt.setResponse('override')
        
        yield* writeEntry('new/repo', 'nvim', false)
        
        const updatedConfig = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(updatedConfig.nvim?.source).toBe('new/repo')
          expect(updatedConfig.nvim?.target).toBe('/test-home/.config/nvim')
        })
      })
    )

    it.layer(TestServices)('should handle user cancel choice', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const mockPrompt = yield* MockPromptService
        
        const initialConfig = { nvim: { target: '/test-home/.config/nvim' } }
        const tomlContent = configToTOML(initialConfig)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        yield* mockPrompt.setResponse('cancel')
        
        const result = yield* writeEntry('new/repo', 'nvim', false).pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('UserDeniedOverrideError')
          }
        })
      })
    )
  })

  describe('removeEntry', () => {
    it.layer(TestServices)('should remove existing entry', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = createRealisticConfig(3)
        const tomlContent = configToTOML(initialConfig)
        const entryToRemove = Object.keys(initialConfig)[0]!
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        
        yield* removeEntry(entryToRemove)
        
        const updatedConfig = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(updatedConfig[entryToRemove]).toBeUndefined()
          expect(Object.keys(updatedConfig)).toHaveLength(2)
        })
      })
    )

    it.layer(TestServices)('should handle non-existent entry gracefully', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = createRealisticConfig(2)
        const tomlContent = configToTOML(initialConfig)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        
        const result = yield* removeEntry('nonexistent').pipe(Effect.either)
        
        // Should not fail, just log warning
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Right')
        })
        
        // Config should remain unchanged
        const config = yield* readConfig()
        yield* Effect.sync(() => {
          expect(config).toEqual(initialConfig)
        })
      })
    )

    it.layer(TestServices)('should handle empty config', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        yield* mockFs.writeFile(TEST_CONFIG_PATH, '')
        
        const result = yield* removeEntry('anything').pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Right')
        })
      })
    )
  })

  describe('Configuration Consistency', () => {
    it.layer(TestServices)('should maintain TOML format after operations', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = createRealisticConfig(2)
        const tomlContent = configToTOML(initialConfig)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, tomlContent)
        
        // Add entry
        yield* writeEntry('user/newrepo', 'newapp', false)
        
        // Remove entry  
        yield* removeEntry('newapp')
        
        // Should be back to original
        const finalConfig = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(finalConfig).toEqual(initialConfig)
        })
      })
    )

    it.layer(TestServices)('should handle concurrent-like operations', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = {}
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, configToTOML(initialConfig))
        
        // Multiple sequential operations
        yield* writeEntry('user1/repo1', 'app1', false)
        yield* writeEntry('user2/repo2', 'app2', false) 
        yield* writeEntry('/local/path', 'app3', true)
        yield* removeEntry('app1')
        
        const finalConfig = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(Object.keys(finalConfig)).toHaveLength(2)
          expect(finalConfig.app1).toBeUndefined()
          expect(finalConfig.app2).toBeDefined()
          expect(finalConfig.app3).toBeDefined()
          expect(finalConfig.app2?.source).toBe('user2/repo2')
          expect(finalConfig.app3?.source).toBeUndefined()
        })
      })
    )
  })

  describe('Error Scenarios', () => {
    it.layer(TestServices)('should handle file system write errors', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const initialConfig = createRealisticConfig(1)
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, configToTOML(initialConfig))
        
        // Simulate write error by removing the directory
        yield* mockFs.rm('/test-home/.dotfiles', { recursive: true })
        
        const result = yield* writeEntry('user/repo', 'newapp', false).pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
          if (result._tag === 'Left') {
            expect(result.left._tag).toBe('WriteFileError')
          }
        })
      })
    )

    it.layer(TestServices)('should handle schema validation errors in stored config', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        const invalidToml = `
          [app]
          # Missing required target field
          source = "user/repo"
        `
        
        yield* mockFs.writeFile(TEST_CONFIG_PATH, invalidToml)
        
        const result = yield* readConfig().pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
        })
      })
    )

    it.layer(TestServices)('should handle corrupted TOML files', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        
        // Write binary data that's not valid TOML
        yield* mockFs.writeFile(TEST_CONFIG_PATH, '\x00\x01\x02\x03')
        
        const result = yield* readConfig().pipe(Effect.either)
        
        yield* Effect.sync(() => {
          expect(result._tag).toBe('Left')
        })
      })
    )
  })

  describe('Path Resolution', () => {
    it.layer(TestServices)('should generate correct target paths for local entries', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        yield* mockFs.writeFile(TEST_CONFIG_PATH, '')
        
        yield* writeEntry('/some/local/path', 'myapp', true)
        
        const config = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(config.myapp?.target).toBe('/test-home/.config/myapp')
        })
      })
    )

    it.layer(TestServices)('should generate correct target paths for git entries', () =>
      Effect.gen(function* () {
        const mockFs = yield* MockFileSystemService
        yield* mockFs.writeFile(TEST_CONFIG_PATH, '')
        
        yield* writeEntry('user/repo', 'myapp', false)
        
        const config = yield* readConfig()
        
        yield* Effect.sync(() => {
          expect(config.myapp?.target).toBe('/test-home/.config/myapp')
          expect(config.myapp?.source).toBe('user/repo')
        })
      })
    )
  })
})