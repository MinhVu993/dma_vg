import Vue from 'vue'
import Vuetify from 'vuetify/lib'
import colors from 'vuetify/lib/util/colors'
import VueSession from 'vue-session'
import ExcelJS  from 'exceljs'
import excel from 'vue-excel-export'
import Notifications from 'vue-notification'
import velocity from 'velocity-animate'
import { VueMaskDirective } from 'v-mask'
let options = { persist: true }
Vue.use(VueSession, options)
Vue.use(excel)
Vue.use(ExcelJS )
Vue.use(Notifications, { velocity })
Vue.directive('mask', VueMaskDirective);