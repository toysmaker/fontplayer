import {
  update as update_100_丷,
  parameters as parameters_100_丷
} from './components/100_丷'
import {
  update as update_190_贝,
  parameters as parameters_190_贝
} from './components/190_贝'
import {
  update as update_147_白,
  parameters as parameters_147_白
} from './components/147_白'

const componentsScripts = {
  '100_丷': {
    update: update_100_丷,
    parameters: parameters_100_丷,
    id: '100_丷',
    name: '丷',
  },
  '190_贝': {
    update: update_190_贝,
    parameters: parameters_190_贝,
    id: '190_贝',
    name: '贝',
  },
  '147_白': {
    update: update_147_白,
    parameters: parameters_147_白,
    id: '147_白',
    name: '白',
  },
}

const componentsScriptsArr = Object.keys(componentsScripts).map((key) => componentsScripts[key])

export {
  componentsScripts,
  componentsScriptsArr,
}