/**
 * 工程Mock数据
 */

import type { IFile } from '@/core/types'
import { createMockFile } from '../../helpers/mock-helpers'

export const mockProject: IFile = createMockFile({
  name: 'Mock Project',
  uuid: 'mock-project-uuid',
})

export const mockProjects: IFile[] = [
  createMockFile({ name: 'Project 1', uuid: 'project-1' }),
  createMockFile({ name: 'Project 2', uuid: 'project-2' }),
  createMockFile({ name: 'Project 3', uuid: 'project-3' }),
]
