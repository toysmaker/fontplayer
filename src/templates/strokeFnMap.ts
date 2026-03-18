import { applySkeletonTransformation } from "@/features/glyphSkeletonBind"
import { CustomGlyph } from "@/core/instance/CustomGlyph"
import { updateParamsByJoints as updateParamsByJoints_heng, computeParamsByJoints as computeParamsByJoints_heng, bindSkeletonGlyph_heng, instanceBasicGlyph_heng, updateSkeletonListener_before_bind_heng, updateSkeletonListener_after_bind_heng } from "./kai/横"
import { updateParamsByJoints as updateParamsByJoints_shu, computeParamsByJoints as computeParamsByJoints_shu, bindSkeletonGlyph_shu, instanceBasicGlyph_shu, updateSkeletonListener_before_bind_shu, updateSkeletonListener_after_bind_shu } from "./kai/竖"
import { updateParamsByJoints as updateParamsByJoints_pie, computeParamsByJoints as computeParamsByJoints_pie, bindSkeletonGlyph_pie, instanceBasicGlyph_pie, updateSkeletonListener_before_bind_pie, updateSkeletonListener_after_bind_pie } from "./kai/撇"
import { updateParamsByJoints as updateParamsByJoints_na, computeParamsByJoints as computeParamsByJoints_na, bindSkeletonGlyph_na, instanceBasicGlyph_na, updateSkeletonListener_before_bind_na, updateSkeletonListener_after_bind_na } from "./kai/捺"
import { updateParamsByJoints as updateParamsByJoints_dian, computeParamsByJoints as computeParamsByJoints_dian, bindSkeletonGlyph_dian, instanceBasicGlyph_dian, updateSkeletonListener_before_bind_dian, updateSkeletonListener_after_bind_dian } from "./kai/点"
import { updateParamsByJoints as updateParamsByJoints_tiao, computeParamsByJoints as computeParamsByJoints_tiao, bindSkeletonGlyph_tiao, instanceBasicGlyph_tiao, updateSkeletonListener_before_bind_tiao, updateSkeletonListener_after_bind_tiao } from "./kai/挑"
import { updateParamsByJoints as updateParamsByJoints_heng_gou, computeParamsByJoints as computeParamsByJoints_heng_gou, bindSkeletonGlyph_heng_gou, instanceBasicGlyph_heng_gou, updateSkeletonListener_before_bind_heng_gou, updateSkeletonListener_after_bind_heng_gou } from "./kai/横钩"
import { updateParamsByJoints as updateParamsByJoints_wan_gou, computeParamsByJoints as computeParamsByJoints_wan_gou, bindSkeletonGlyph_wan_gou, instanceBasicGlyph_wan_gou, updateSkeletonListener_before_bind_wan_gou, updateSkeletonListener_after_bind_wan_gou } from "./kai/弯钩"
import { updateParamsByJoints as updateParamsByJoints_shu_gou, computeParamsByJoints as computeParamsByJoints_shu_gou, bindSkeletonGlyph_shu_gou, instanceBasicGlyph_shu_gou, updateSkeletonListener_before_bind_shu_gou, updateSkeletonListener_after_bind_shu_gou } from "./kai/竖钩"
import { updateParamsByJoints as updateParamsByJoints_shu_zhe_zhe_gou, computeParamsByJoints as computeParamsByJoints_shu_zhe_zhe_gou, bindSkeletonGlyph_shu_zhe_zhe_gou, instanceBasicGlyph_shu_zhe_zhe_gou, updateSkeletonListener_before_bind_shu_zhe_zhe_gou, updateSkeletonListener_after_bind_shu_zhe_zhe_gou } from "./kai/竖折折钩"
import { updateParamsByJoints as updateParamsByJoints_heng_pie, computeParamsByJoints as computeParamsByJoints_heng_pie, bindSkeletonGlyph_heng_pie, instanceBasicGlyph_heng_pie, updateSkeletonListener_before_bind_heng_pie, updateSkeletonListener_after_bind_heng_pie } from "./kai/横撇"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe, computeParamsByJoints as computeParamsByJoints_heng_zhe, bindSkeletonGlyph_heng_zhe, instanceBasicGlyph_heng_zhe, updateSkeletonListener_before_bind_heng_zhe, updateSkeletonListener_after_bind_heng_zhe } from "./kai/横折"
import { updateParamsByJoints as updateParamsByJoints_shu_pie, computeParamsByJoints as computeParamsByJoints_shu_pie, bindSkeletonGlyph_shu_pie, instanceBasicGlyph_shu_pie, updateSkeletonListener_before_bind_shu_pie, updateSkeletonListener_after_bind_shu_pie } from "./kai/竖撇"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe_zhe_pie, computeParamsByJoints as computeParamsByJoints_heng_zhe_zhe_pie, bindSkeletonGlyph_heng_zhe_zhe_pie, instanceBasicGlyph_heng_zhe_zhe_pie, updateSkeletonListener_before_bind_heng_zhe_zhe_pie, updateSkeletonListener_after_bind_heng_zhe_zhe_pie } from "./kai/横折折撇"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe_gou, computeParamsByJoints as computeParamsByJoints_heng_zhe_gou, bindSkeletonGlyph_heng_zhe_gou, instanceBasicGlyph_heng_zhe_gou, updateSkeletonListener_before_bind_heng_zhe_gou, updateSkeletonListener_after_bind_heng_zhe_gou } from "./kai/横折钩"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe_wan_gou, computeParamsByJoints as computeParamsByJoints_heng_zhe_wan_gou, bindSkeletonGlyph_heng_zhe_wan_gou, instanceBasicGlyph_heng_zhe_wan_gou, updateSkeletonListener_before_bind_heng_zhe_wan_gou, updateSkeletonListener_after_bind_heng_zhe_wan_gou } from "./kai/横折弯钩"
import { updateParamsByJoints as updateParamsByJoints_heng_wan_gou, computeParamsByJoints as computeParamsByJoints_heng_wan_gou, bindSkeletonGlyph_heng_wan_gou, instanceBasicGlyph_heng_wan_gou, updateSkeletonListener_before_bind_heng_wan_gou, updateSkeletonListener_after_bind_heng_wan_gou } from "./kai/横弯钩"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe_zhe_wan_gou, computeParamsByJoints as computeParamsByJoints_heng_zhe_zhe_wan_gou, bindSkeletonGlyph_heng_zhe_zhe_wan_gou, instanceBasicGlyph_heng_zhe_zhe_wan_gou, updateSkeletonListener_before_bind_heng_zhe_zhe_wan_gou, updateSkeletonListener_after_bind_heng_zhe_zhe_wan_gou } from "./kai/横折折弯钩"
import { updateParamsByJoints as updateParamsByJoints_er_heng_zhe, computeParamsByJoints as computeParamsByJoints_er_heng_zhe, bindSkeletonGlyph_er_heng_zhe, instanceBasicGlyph_er_heng_zhe, updateSkeletonListener_before_bind_er_heng_zhe, updateSkeletonListener_after_bind_er_heng_zhe } from "./kai/二横折"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe_wan, computeParamsByJoints as computeParamsByJoints_heng_zhe_wan, bindSkeletonGlyph_heng_zhe_wan, instanceBasicGlyph_heng_zhe_wan, updateSkeletonListener_before_bind_heng_zhe_wan, updateSkeletonListener_after_bind_heng_zhe_wan } from "./kai/横折弯"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe2, computeParamsByJoints as computeParamsByJoints_heng_zhe2, bindSkeletonGlyph_heng_zhe2, instanceBasicGlyph_heng_zhe2, updateSkeletonListener_before_bind_heng_zhe2, updateSkeletonListener_after_bind_heng_zhe2 } from "./kai/横折2"
import { updateParamsByJoints as updateParamsByJoints_heng_zhe_tiao, computeParamsByJoints as computeParamsByJoints_heng_zhe_tiao, bindSkeletonGlyph_heng_zhe_tiao, instanceBasicGlyph_heng_zhe_tiao, updateSkeletonListener_before_bind_heng_zhe_tiao, updateSkeletonListener_after_bind_heng_zhe_tiao } from "./kai/横折挑"
import { updateParamsByJoints as updateParamsByJoints_shu_tiao, computeParamsByJoints as computeParamsByJoints_shu_tiao, bindSkeletonGlyph_shu_tiao, instanceBasicGlyph_shu_tiao, updateSkeletonListener_before_bind_shu_tiao, updateSkeletonListener_after_bind_shu_tiao } from "./kai/竖挑"
import { updateParamsByJoints as updateParamsByJoints_shu_wan, computeParamsByJoints as computeParamsByJoints_shu_wan, bindSkeletonGlyph_shu_wan, instanceBasicGlyph_shu_wan, updateSkeletonListener_before_bind_shu_wan, updateSkeletonListener_after_bind_shu_wan } from "./kai/竖弯"
import { updateParamsByJoints as updateParamsByJoints_shu_wan_gou, computeParamsByJoints as computeParamsByJoints_shu_wan_gou, bindSkeletonGlyph_shu_wan_gou, instanceBasicGlyph_shu_wan_gou, updateSkeletonListener_before_bind_shu_wan_gou, updateSkeletonListener_after_bind_shu_wan_gou } from "./kai/竖弯钩"
import { updateParamsByJoints as updateParamsByJoints_shu_zhe, computeParamsByJoints as computeParamsByJoints_shu_zhe, bindSkeletonGlyph_shu_zhe, instanceBasicGlyph_shu_zhe, updateSkeletonListener_before_bind_shu_zhe, updateSkeletonListener_after_bind_shu_zhe } from "./kai/竖折"
import { updateParamsByJoints as updateParamsByJoints_xie_gou, computeParamsByJoints as computeParamsByJoints_xie_gou, bindSkeletonGlyph_xie_gou, instanceBasicGlyph_xie_gou, updateSkeletonListener_before_bind_xie_gou, updateSkeletonListener_after_bind_xie_gou } from "./kai/斜钩"
import { updateParamsByJoints as updateParamsByJoints_heng_pie_wan_gou, computeParamsByJoints as computeParamsByJoints_heng_pie_wan_gou, bindSkeletonGlyph_heng_pie_wan_gou, instanceBasicGlyph_heng_pie_wan_gou, updateSkeletonListener_before_bind_heng_pie_wan_gou, updateSkeletonListener_after_bind_heng_pie_wan_gou } from "./kai/横撇弯钩"
import { updateParamsByJoints as updateParamsByJoints_pie_tiao, computeParamsByJoints as computeParamsByJoints_pie_tiao, bindSkeletonGlyph_pie_tiao, instanceBasicGlyph_pie_tiao, updateSkeletonListener_before_bind_pie_tiao, updateSkeletonListener_after_bind_pie_tiao } from "./kai/撇挑"
import { updateParamsByJoints as updateParamsByJoints_pie_dian, computeParamsByJoints as computeParamsByJoints_pie_dian, bindSkeletonGlyph_pie_dian, instanceBasicGlyph_pie_dian, updateSkeletonListener_before_bind_pie_dian, updateSkeletonListener_after_bind_pie_dian } from "./kai/撇点"
import { updateParamsByJoints as updateParamsByJoints_tiao_na, computeParamsByJoints as computeParamsByJoints_tiao_na, bindSkeletonGlyph_tiao_na, instanceBasicGlyph_tiao_na, updateSkeletonListener_before_bind_tiao_na, updateSkeletonListener_after_bind_tiao_na } from "./kai/挑捺"
import { updateParamsByJoints as updateParamsByJoints_ping_na, computeParamsByJoints as computeParamsByJoints_ping_na, bindSkeletonGlyph_ping_na, instanceBasicGlyph_ping_na, updateSkeletonListener_before_bind_ping_na, updateSkeletonListener_after_bind_ping_na } from "./kai/平捺"

const updateSkeletonTransformation = (glyph: CustomGlyph) => {
  const skeleton = glyph.getSkeleton()
  applySkeletonTransformation(glyph, skeleton)
}

const strokeFnMap = {
  '横': {
    instanceBasicGlyph: instanceBasicGlyph_heng,
    bindSkeletonGlyph: bindSkeletonGlyph_heng,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng,
    updateParamsByJoints: updateParamsByJoints_heng,
  },
  '竖': {
    instanceBasicGlyph: instanceBasicGlyph_shu,
    bindSkeletonGlyph: bindSkeletonGlyph_shu,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu,
    updateParamsByJoints: updateParamsByJoints_shu,
  },
  '撇': {
    instanceBasicGlyph: instanceBasicGlyph_pie,
    bindSkeletonGlyph: bindSkeletonGlyph_pie,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_pie,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_pie,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_pie,
    updateParamsByJoints: updateParamsByJoints_pie,
  },
  '捺': {
    instanceBasicGlyph: instanceBasicGlyph_na,
    bindSkeletonGlyph: bindSkeletonGlyph_na,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_na,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_na,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_na,
    updateParamsByJoints: updateParamsByJoints_na,
  },
  '点': {
    instanceBasicGlyph: instanceBasicGlyph_dian,
    bindSkeletonGlyph: bindSkeletonGlyph_dian,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_dian,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_dian,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_dian,
    updateParamsByJoints: updateParamsByJoints_dian,
  },
  '挑': {
    instanceBasicGlyph: instanceBasicGlyph_tiao,
    bindSkeletonGlyph: bindSkeletonGlyph_tiao,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_tiao,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_tiao,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_tiao,
    updateParamsByJoints: updateParamsByJoints_tiao,
  },
  '横钩': {
    instanceBasicGlyph: instanceBasicGlyph_heng_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_gou,
    updateParamsByJoints: updateParamsByJoints_heng_gou,
  },
  '弯钩': {
    instanceBasicGlyph: instanceBasicGlyph_wan_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_wan_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_wan_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_wan_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_wan_gou,
    updateParamsByJoints: updateParamsByJoints_wan_gou,
  },
  '竖钩': {
    instanceBasicGlyph: instanceBasicGlyph_shu_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_gou,
    updateParamsByJoints: updateParamsByJoints_shu_gou,
  },
  '竖折折钩': {
    instanceBasicGlyph: instanceBasicGlyph_shu_zhe_zhe_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_zhe_zhe_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_zhe_zhe_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_zhe_zhe_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_zhe_zhe_gou,
    updateParamsByJoints: updateParamsByJoints_shu_zhe_zhe_gou,
  },
  '横撇': {
    instanceBasicGlyph: instanceBasicGlyph_heng_pie,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_pie,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_pie,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_pie,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_pie,
    updateParamsByJoints: updateParamsByJoints_heng_pie,
  },
  '横折': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe,
    updateParamsByJoints: updateParamsByJoints_heng_zhe,
  },
  '竖撇': {
    instanceBasicGlyph: instanceBasicGlyph_shu_pie,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_pie,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_pie,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_pie,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_pie,
    updateParamsByJoints: updateParamsByJoints_shu_pie,
  },
  '横折折撇': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe_zhe_pie,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe_zhe_pie,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe_zhe_pie,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe_zhe_pie,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe_zhe_pie,
    updateParamsByJoints: updateParamsByJoints_heng_zhe_zhe_pie,
  },
  '横折钩': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe_gou,
    updateParamsByJoints: updateParamsByJoints_heng_zhe_gou,
  },
  '横折弯钩': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe_wan_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe_wan_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe_wan_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe_wan_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe_wan_gou,
    updateParamsByJoints: updateParamsByJoints_heng_zhe_wan_gou,
  },
  '横弯钩': {
    instanceBasicGlyph: instanceBasicGlyph_heng_wan_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_wan_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_wan_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_wan_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_wan_gou,
    updateParamsByJoints: updateParamsByJoints_heng_wan_gou,
  },
  '横折折弯钩': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe_zhe_wan_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe_zhe_wan_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe_zhe_wan_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe_zhe_wan_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe_zhe_wan_gou,
    updateParamsByJoints: updateParamsByJoints_heng_zhe_zhe_wan_gou,
  },
  '二横折': {
    instanceBasicGlyph: instanceBasicGlyph_er_heng_zhe,
    bindSkeletonGlyph: bindSkeletonGlyph_er_heng_zhe,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_er_heng_zhe,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_er_heng_zhe,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_er_heng_zhe,
    updateParamsByJoints: updateParamsByJoints_er_heng_zhe,
  },
  '横折弯': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe_wan,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe_wan,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe_wan,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe_wan,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe_wan,
    updateParamsByJoints: updateParamsByJoints_heng_zhe_wan,
  },
  '横折2': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe2,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe2,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe2,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe2,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe2,
    updateParamsByJoints: updateParamsByJoints_heng_zhe2,
  },
  '横折挑': {
    instanceBasicGlyph: instanceBasicGlyph_heng_zhe_tiao,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_zhe_tiao,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_zhe_tiao,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_zhe_tiao,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_zhe_tiao,
    updateParamsByJoints: updateParamsByJoints_heng_zhe_tiao,
  },
  '竖挑': {
    instanceBasicGlyph: instanceBasicGlyph_shu_tiao,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_tiao,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_tiao,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_tiao,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_tiao,
    updateParamsByJoints: updateParamsByJoints_shu_tiao,
  },
  '竖弯': {
    instanceBasicGlyph: instanceBasicGlyph_shu_wan,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_wan,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_wan,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_wan,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_wan,
    updateParamsByJoints: updateParamsByJoints_shu_wan,
  },
  '竖弯钩': {
    instanceBasicGlyph: instanceBasicGlyph_shu_wan_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_wan_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_wan_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_wan_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_wan_gou,
    updateParamsByJoints: updateParamsByJoints_shu_wan_gou,
  },
  '竖折': {
    instanceBasicGlyph: instanceBasicGlyph_shu_zhe,
    bindSkeletonGlyph: bindSkeletonGlyph_shu_zhe,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_shu_zhe,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_shu_zhe,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_shu_zhe,
    updateParamsByJoints: updateParamsByJoints_shu_zhe,
  },
  '斜钩': {
    instanceBasicGlyph: instanceBasicGlyph_xie_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_xie_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_xie_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_xie_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_xie_gou,
    updateParamsByJoints: updateParamsByJoints_xie_gou,
  },
  '横撇弯钩': {
    instanceBasicGlyph: instanceBasicGlyph_heng_pie_wan_gou,
    bindSkeletonGlyph: bindSkeletonGlyph_heng_pie_wan_gou,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_heng_pie_wan_gou,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_heng_pie_wan_gou,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_heng_pie_wan_gou,
    updateParamsByJoints: updateParamsByJoints_heng_pie_wan_gou,
  },
  '撇挑': {
    instanceBasicGlyph: instanceBasicGlyph_pie_tiao,
    bindSkeletonGlyph: bindSkeletonGlyph_pie_tiao,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_pie_tiao,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_pie_tiao,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_pie_tiao,
    updateParamsByJoints: updateParamsByJoints_pie_tiao,
  },
  '撇点': {
    instanceBasicGlyph: instanceBasicGlyph_pie_dian,
    bindSkeletonGlyph: bindSkeletonGlyph_pie_dian,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_pie_dian,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_pie_dian,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_pie_dian,
    updateParamsByJoints: updateParamsByJoints_pie_dian,
  },
  '挑捺': {
    instanceBasicGlyph: instanceBasicGlyph_tiao_na,
    bindSkeletonGlyph: bindSkeletonGlyph_tiao_na,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_tiao_na,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_tiao_na,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_tiao_na,
    updateParamsByJoints: updateParamsByJoints_tiao_na,
  },
  '平捺': {
    instanceBasicGlyph: instanceBasicGlyph_ping_na,
    bindSkeletonGlyph: bindSkeletonGlyph_ping_na,
    updateSkeletonListenerBeforeBind: updateSkeletonListener_before_bind_ping_na,
    updateSkeletonListenerAfterBind: updateSkeletonListener_after_bind_ping_na,
    updateSkeletonTransformation: updateSkeletonTransformation,
    computeParamsByJoints: computeParamsByJoints_ping_na,
    updateParamsByJoints: updateParamsByJoints_ping_na,
  },
}

export { strokeFnMap, updateSkeletonTransformation }