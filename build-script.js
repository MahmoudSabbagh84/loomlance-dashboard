import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

console.log('🚀 Starting production build...')

try {
  // Set production environment
  process.env.NODE_ENV = 'production'
  
  // Run build command
  console.log('📦 Building application...')
  execSync('npm run build', { stdio: 'inherit' })
  
  // Verify build output
  const distPath = path.join(process.cwd(), 'dist')
  if (!fs.existsSync(distPath)) {
    throw new Error('Build failed - dist directory not found')
  }
  
  console.log('✅ Build completed successfully!')
  console.log('📁 Build output:', distPath)
  
} catch (error) {
  console.error('❌ Build failed:', error.message)
  process.exit(1)
}
