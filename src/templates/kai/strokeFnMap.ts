import { applySkeletonTransformation } from "@/features/glyphSkeletonBind"
import type { CustomGlyph } from "@/core/instance/CustomGlyph"

export const updateSkeletonTransformation = (glyph: CustomGlyph) => {
  const skeleton = (glyph as any).getSkeleton?.()
  if (!skeleton) return
  applySkeletonTransformation(glyph as any, skeleton)
}

