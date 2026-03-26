/**
 * 字玩「测试笔画模板」专用：与原版 fontplayer templates/custom_1/strokeFnMap 一致。
 * 主工程 strokeFnMap（kai/）用于常规字形；替换部件时必须走此表，否则 computeParamsByJoints 与原版不符。
 */
import { updateParamsByJoints as updateParamsByJoints_dian, computeParamsByJoints as computeParamsByJoints_dian } from './点'
import { updateParamsByJoints as updateParamsByJoints_heng, computeParamsByJoints as computeParamsByJoints_heng } from './横'
import { updateParamsByJoints as updateParamsByJoints_shu, computeParamsByJoints as computeParamsByJoints_shu } from './竖'
import { updateParamsByJoints as updateParamsByJoints_pie, computeParamsByJoints as computeParamsByJoints_pie } from './撇'
import { updateParamsByJoints as updateParamsByJoints_na, computeParamsByJoints as computeParamsByJoints_na } from './捺'
import { updateParamsByJoints as updateParamsByJoints_tiao, computeParamsByJoints as computeParamsByJoints_tiao } from './挑'
import { updateParamsByJoints as updateParamsByJoints_yuan, computeParamsByJoints as computeParamsByJoints_yuan } from './圆'
import { updateParamsByJoints as updateParamsByJoints_wangou, computeParamsByJoints as computeParamsByJoints_wangou } from './弯钩'
import { updateParamsByJoints as updateParamsByJoints_zhishupie, computeParamsByJoints as computeParamsByJoints_zhishupie } from './直竖撇'
import { updateParamsByJoints as updateParamsByJoints_zhishuna, computeParamsByJoints as computeParamsByJoints_zhishuna } from './直竖捺'
import { updateParamsByJoints as updateParamsByJoints_zhijiaopie, computeParamsByJoints as computeParamsByJoints_zhijiaopie } from './直角撇'
import { updateParamsByJoints as updateParamsByJoints_zhijiaona, computeParamsByJoints as computeParamsByJoints_zhijiaona } from './直角捺'
import { updateParamsByJoints as updateParamsByJoints_zhidian, computeParamsByJoints as computeParamsByJoints_zhidian } from './直点'
import { updateParamsByJoints as updateParamsByJoints_pingpie, computeParamsByJoints as computeParamsByJoints_pingpie } from './平撇'
import { updateParamsByJoints as updateParamsByJoints_pingna, computeParamsByJoints as computeParamsByJoints_pingna } from './平捺'
import { updateParamsByJoints as updateParamsByJoints_duanzhipie, computeParamsByJoints as computeParamsByJoints_duanzhipie } from './短直撇'
import { updateParamsByJoints as updateParamsByJoints_shugou, computeParamsByJoints as computeParamsByJoints_shugou } from './竖钩'
import { updateParamsByJoints as updateParamsByJoints_shutiao, computeParamsByJoints as computeParamsByJoints_shutiao } from './竖挑'
import { updateParamsByJoints as updateParamsByJoints_shuwan, computeParamsByJoints as computeParamsByJoints_shuwan } from './竖弯'
import { updateParamsByJoints as updateParamsByJoints_shuwangou, computeParamsByJoints as computeParamsByJoints_shuwangou } from './竖弯钩'
import { updateParamsByJoints as updateParamsByJoints_shuzhe, computeParamsByJoints as computeParamsByJoints_shuzhe } from './竖折'
import { updateParamsByJoints as updateParamsByJoints_shuzhezhegou, computeParamsByJoints as computeParamsByJoints_shuzhezhegou } from './竖折折钩'
import { updateParamsByJoints as updateParamsByJoints_piezhe, computeParamsByJoints as computeParamsByJoints_piezhe } from './撇折'
import { updateParamsByJoints as updateParamsByJoints_pietiao, computeParamsByJoints as computeParamsByJoints_pietiao } from './撇挑'
import { updateParamsByJoints as updateParamsByJoints_piedian, computeParamsByJoints as computeParamsByJoints_piedian } from './撇点'
import { updateParamsByJoints as updateParamsByJoints_hengzhe, computeParamsByJoints as computeParamsByJoints_hengzhe } from './横折'
import { updateParamsByJoints as updateParamsByJoints_hengzhe2, computeParamsByJoints as computeParamsByJoints_hengzhe2 } from './横折2'
import { updateParamsByJoints as updateParamsByJoints_hengzhegou, computeParamsByJoints as computeParamsByJoints_hengzhegou } from './横折钩'
import { updateParamsByJoints as updateParamsByJoints_hengzhetiao, computeParamsByJoints as computeParamsByJoints_hengzhetiao } from './横折挑'
import { updateParamsByJoints as updateParamsByJoints_hengzhewan, computeParamsByJoints as computeParamsByJoints_hengzhewan } from './横折弯'
import { updateParamsByJoints as updateParamsByJoints_hengzhewangou, computeParamsByJoints as computeParamsByJoints_hengzhewangou } from './横折弯钩'
import { updateParamsByJoints as updateParamsByJoints_hengzhezhepie, computeParamsByJoints as computeParamsByJoints_hengzhezhepie } from './横折折撇'
import { updateParamsByJoints as updateParamsByJoints_hengzhezhewangou, computeParamsByJoints as computeParamsByJoints_hengzhezhewangou } from './横折折弯钩'
import { updateParamsByJoints as updateParamsByJoints_hengpie, computeParamsByJoints as computeParamsByJoints_hengpie } from './横撇'
import { updateParamsByJoints as updateParamsByJoints_hengpiewangou, computeParamsByJoints as computeParamsByJoints_hengpiewangou } from './横撇弯钩'
import { updateParamsByJoints as updateParamsByJoints_henggou, computeParamsByJoints as computeParamsByJoints_henggou } from './横钩'
import { updateParamsByJoints as updateParamsByJoints_hengwangou, computeParamsByJoints as computeParamsByJoints_hengwangou } from './横弯钩'
import { updateParamsByJoints as updateParamsByJoints_erhengzhe, computeParamsByJoints as computeParamsByJoints_erhengzhe } from './二横折'
import { updateParamsByJoints as updateParamsByJoints_shuipingdanyuanjiaobujian, computeParamsByJoints as computeParamsByJoints_shuipingdanyuanjiaobujian } from './水平单圆角部件'
import { updateParamsByJoints as updateParamsByJoints_shuzhidanyuanjiaobujian, computeParamsByJoints as computeParamsByJoints_shuzhidanyuanjiaobujian } from './竖直单圆角部件'

const strokeFnMap = {
  点: {
    computeParamsByJoints: computeParamsByJoints_dian,
    updateParamsByJoints: updateParamsByJoints_dian,
  },
  横: {
    computeParamsByJoints: computeParamsByJoints_heng,
    updateParamsByJoints: updateParamsByJoints_heng,
  },
  竖: {
    computeParamsByJoints: computeParamsByJoints_shu,
    updateParamsByJoints: updateParamsByJoints_shu,
  },
  撇: {
    computeParamsByJoints: computeParamsByJoints_pie,
    updateParamsByJoints: updateParamsByJoints_pie,
  },
  捺: {
    computeParamsByJoints: computeParamsByJoints_na,
    updateParamsByJoints: updateParamsByJoints_na,
  },
  挑: {
    computeParamsByJoints: computeParamsByJoints_tiao,
    updateParamsByJoints: updateParamsByJoints_tiao,
  },
  圆: {
    computeParamsByJoints: computeParamsByJoints_yuan,
    updateParamsByJoints: updateParamsByJoints_yuan,
  },
  弯钩: {
    computeParamsByJoints: computeParamsByJoints_wangou,
    updateParamsByJoints: updateParamsByJoints_wangou,
  },
  直竖撇: {
    computeParamsByJoints: computeParamsByJoints_zhishupie,
    updateParamsByJoints: updateParamsByJoints_zhishupie,
  },
  直竖捺: {
    computeParamsByJoints: computeParamsByJoints_zhishuna,
    updateParamsByJoints: updateParamsByJoints_zhishuna,
  },
  直角撇: {
    computeParamsByJoints: computeParamsByJoints_zhijiaopie,
    updateParamsByJoints: updateParamsByJoints_zhijiaopie,
  },
  直角捺: {
    computeParamsByJoints: computeParamsByJoints_zhijiaona,
    updateParamsByJoints: updateParamsByJoints_zhijiaona,
  },
  直点: {
    computeParamsByJoints: computeParamsByJoints_zhidian,
    updateParamsByJoints: updateParamsByJoints_zhidian,
  },
  平撇: {
    computeParamsByJoints: computeParamsByJoints_pingpie,
    updateParamsByJoints: updateParamsByJoints_pingpie,
  },
  平捺: {
    computeParamsByJoints: computeParamsByJoints_pingna,
    updateParamsByJoints: updateParamsByJoints_pingna,
  },
  短直撇: {
    computeParamsByJoints: computeParamsByJoints_duanzhipie,
    updateParamsByJoints: updateParamsByJoints_duanzhipie,
  },
  竖钩: {
    computeParamsByJoints: computeParamsByJoints_shugou,
    updateParamsByJoints: updateParamsByJoints_shugou,
  },
  竖挑: {
    computeParamsByJoints: computeParamsByJoints_shutiao,
    updateParamsByJoints: updateParamsByJoints_shutiao,
  },
  竖弯: {
    computeParamsByJoints: computeParamsByJoints_shuwan,
    updateParamsByJoints: updateParamsByJoints_shuwan,
  },
  竖弯钩: {
    computeParamsByJoints: computeParamsByJoints_shuwangou,
    updateParamsByJoints: updateParamsByJoints_shuwangou,
  },
  竖折: {
    computeParamsByJoints: computeParamsByJoints_shuzhe,
    updateParamsByJoints: updateParamsByJoints_shuzhe,
  },
  竖折折钩: {
    computeParamsByJoints: computeParamsByJoints_shuzhezhegou,
    updateParamsByJoints: updateParamsByJoints_shuzhezhegou,
  },
  撇折: {
    computeParamsByJoints: computeParamsByJoints_piezhe,
    updateParamsByJoints: updateParamsByJoints_piezhe,
  },
  撇挑: {
    computeParamsByJoints: computeParamsByJoints_pietiao,
    updateParamsByJoints: updateParamsByJoints_pietiao,
  },
  撇点: {
    computeParamsByJoints: computeParamsByJoints_piedian,
    updateParamsByJoints: updateParamsByJoints_piedian,
  },
  横折: {
    computeParamsByJoints: computeParamsByJoints_hengzhe,
    updateParamsByJoints: updateParamsByJoints_hengzhe,
  },
  横折2: {
    computeParamsByJoints: computeParamsByJoints_hengzhe2,
    updateParamsByJoints: updateParamsByJoints_hengzhe2,
  },
  横折钩: {
    computeParamsByJoints: computeParamsByJoints_hengzhegou,
    updateParamsByJoints: updateParamsByJoints_hengzhegou,
  },
  横折挑: {
    computeParamsByJoints: computeParamsByJoints_hengzhetiao,
    updateParamsByJoints: updateParamsByJoints_hengzhetiao,
  },
  横折弯: {
    computeParamsByJoints: computeParamsByJoints_hengzhewan,
    updateParamsByJoints: updateParamsByJoints_hengzhewan,
  },
  横折弯钩: {
    computeParamsByJoints: computeParamsByJoints_hengzhewangou,
    updateParamsByJoints: updateParamsByJoints_hengzhewangou,
  },
  横折折撇: {
    computeParamsByJoints: computeParamsByJoints_hengzhezhepie,
    updateParamsByJoints: updateParamsByJoints_hengzhezhepie,
  },
  横折折弯钩: {
    computeParamsByJoints: computeParamsByJoints_hengzhezhewangou,
    updateParamsByJoints: updateParamsByJoints_hengzhezhewangou,
  },
  横撇: {
    computeParamsByJoints: computeParamsByJoints_hengpie,
    updateParamsByJoints: updateParamsByJoints_hengpie,
  },
  横撇弯钩: {
    computeParamsByJoints: computeParamsByJoints_hengpiewangou,
    updateParamsByJoints: updateParamsByJoints_hengpiewangou,
  },
  横钩: {
    computeParamsByJoints: computeParamsByJoints_henggou,
    updateParamsByJoints: updateParamsByJoints_henggou,
  },
  横弯钩: {
    computeParamsByJoints: computeParamsByJoints_hengwangou,
    updateParamsByJoints: updateParamsByJoints_hengwangou,
  },
  二横折: {
    computeParamsByJoints: computeParamsByJoints_erhengzhe,
    updateParamsByJoints: updateParamsByJoints_erhengzhe,
  },
  水平单圆角部件: {
    computeParamsByJoints: computeParamsByJoints_shuipingdanyuanjiaobujian,
    updateParamsByJoints: updateParamsByJoints_shuipingdanyuanjiaobujian,
  },
  竖直单圆角部件: {
    computeParamsByJoints: computeParamsByJoints_shuzhidanyuanjiaobujian,
    updateParamsByJoints: updateParamsByJoints_shuzhidanyuanjiaobujian,
  },
}

export { strokeFnMap }
