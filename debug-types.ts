import { Project } from 'ts-morph'

// Create a TypeScript project
const project = new Project({
  tsConfigFilePath: './tsconfig.json'
})

// Get all source files with errors
const sourceFiles = project.getSourceFiles()

console.log('=== TypeScript Diagnostics Analysis ===\n')

for (const sourceFile of sourceFiles) {
  const diagnostics = sourceFile.getPreEmitDiagnostics()
  
  if (diagnostics.length > 0) {
    console.log(`File: ${sourceFile.getFilePath()}`)
    console.log('=' + '='.repeat(sourceFile.getFilePath().length))
    
    diagnostics.forEach((diagnostic, index) => {
      console.log(`\nDiagnostic ${index + 1}:`)
      console.log(`Code: TS${diagnostic.getCode()}`)
      console.log(`Message: ${diagnostic.getMessageText()}`)
      
      const start = diagnostic.getStart()
      if (start !== undefined) {
        const lineAndColumn = sourceFile.getLineAndColumnAtPos(start)
        console.log(`Location: Line ${lineAndColumn.line}, Column ${lineAndColumn.column}`)
        
        // Get surrounding context
        const lines = sourceFile.getFullText().split('\n')
        const startLine = Math.max(0, lineAndColumn.line - 3)
        const endLine = Math.min(lines.length - 1, lineAndColumn.line + 2)
        
        console.log(`\nContext:`)
        for (let i = startLine; i <= endLine; i++) {
          const lineText = lines[i] || ''
          const marker = i === lineAndColumn.line - 1 ? '>>> ' : '    '
          console.log(`${marker}${i + 1}: ${lineText}`)
        }
      }
      console.log('-'.repeat(50))
    })
    console.log('\n')
  }
}

// Also check for specific problematic areas
console.log('\n=== Additional Analysis ===\n')

// Look for @effect/vitest imports
const vitestFiles = sourceFiles.filter(sf => 
  sf.getImportDeclarations().some(imp => 
    imp.getModuleSpecifierValue().includes('@effect/vitest')
  )
)

if (vitestFiles.length > 0) {
  console.log('Files importing @effect/vitest:')
  vitestFiles.forEach(file => {
    console.log(`- ${file.getFilePath()}`)
    const vitestImports = file.getImportDeclarations()
      .filter(imp => imp.getModuleSpecifierValue().includes('@effect/vitest'))
    
    vitestImports.forEach(imp => {
      console.log(`  Import: ${imp.getText()}`)
      const namedImports = imp.getNamedImports()
      namedImports.forEach(named => {
        const symbol = named.getSymbolOrThrow()
        console.log(`    - ${named.getName()}: ${symbol.getValueDeclaration()?.getKindName() || 'unknown'}`)
      })
    })
  })
}

console.log('\n=== Schema Analysis ===\n')

// Check schema files for specific issues
const schemaFiles = sourceFiles.filter(sf => sf.getFilePath().includes('schemas.ts'))
schemaFiles.forEach(file => {
  console.log(`Schema file: ${file.getFilePath()}`)
  
  // Look for Schema.annotations usage
  const annotations = file.getDescendantsOfKind(34 /* PropertyAccessExpression */)
    .filter(expr => expr.getText().includes('annotations'))
  
  console.log(`Found ${annotations.length} .annotations() calls`)
  annotations.forEach((ann, i) => {
    console.log(`  ${i + 1}: ${ann.getText()}`)
    console.log(`     Type: ${ann.getType().getText()}`)
  })
})

console.log('\nAnalysis complete!')