/**
 * 工程文件迁移脚本
 * 用于将原版工程文件转换为重构版格式
 */

import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { ProjectMigrator } from '../src/fontEditor/services/ProjectMigrator'

async function migrateProject() {
  const oldFilePath = process.argv[2]
  const outputFilePath = process.argv[3] || oldFilePath.replace('.json', '_new.json')

  if (!oldFilePath) {
    console.error('Usage: ts-node migrate-project.ts <old-file-path> [output-file-path]')
    process.exit(1)
  }

  try {
    console.log(`Reading old project file: ${oldFilePath}`)
    const oldData = JSON.parse(readFileSync(oldFilePath, 'utf-8'))

    console.log('Migrating project...')
    const migrator = new ProjectMigrator()
    const migratedData = await migrator.migrate(oldData)

    console.log(`Writing migrated project file: ${outputFilePath}`)
    writeFileSync(outputFilePath, JSON.stringify(migratedData, null, 2), 'utf-8')

    console.log('Migration completed successfully!')
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

migrateProject()
