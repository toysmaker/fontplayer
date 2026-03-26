/**
 * 预留：按 Unicode 从 .fpz 定位单字模板（供「添加字符时从模板导入」等后续功能）。
 */

import type { DecodedFpz } from './fpzFormat'

/** 由 TOC 构建 unicode → character uuid（同一 unicode 多条时后者覆盖前者） */
export function buildUnicodeToCharacterUuidMap(decoded: DecodedFpz): Map<number, string> {
  const m = new Map<number, string>()
  for (const e of decoded.toc) {
    if (e.unicode > 0) {
      m.set(e.unicode, e.uuid)
    }
  }
  return m
}

/**
 * 占位：将来可从持久化的 TOC + 资源路径按需解压单块；当前未接 UI。
 */
export async function getTemplateCharacterUuidForUnicode(
  _decoded: DecodedFpz,
  _unicode: number,
): Promise<string | null> {
  return null
}
