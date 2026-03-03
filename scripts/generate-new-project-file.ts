/**
 * 生成新的工程文件格式
 * 从原版工程文件生成适用于重构版的新格式
 */

import * as fs from 'fs'
import * as path from 'path'
import { ProjectMigrator } from '../src/features/editor/services/ProjectMigrator'

const projectMigrator = new ProjectMigrator()

async function generateNewProjectFile() {
  const oldFilePath = '/Users/xuepei/Documents/projects/fontplayer/public/data/字玩标准黑体_12_28.json'
  const outputDir = path.join(__dirname, '../public/data')
  const outputFileName = '字玩标准黑体_12_28_new.json'
  const outputPath = path.join(outputDir, outputFileName)

  try {
    console.log('Reading old project file...')
    const oldData = JSON.parse(fs.readFileSync(oldFilePath, 'utf-8'))
    
    console.log('Migrating project file...')
    const newData = await projectMigrator.migrate(oldData)
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }
    
    console.log('Writing new project file...')
    fs.writeFileSync(outputPath, JSON.stringify(newData, null, 2), 'utf-8')
    
    console.log(`✅ New project file generated: ${outputPath}`)
    console.log(`   Original size: ${(fs.statSync(oldFilePath).size / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   New size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`)
  } catch (error) {
    console.error('Failed to generate new project file:', error)
    process.exit(1)
  }
}

generateNewProjectFile()
