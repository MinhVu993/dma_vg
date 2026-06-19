<template>
  <v-card outlined class="app-flow-card mb-4" elevation="0">
    <v-card-text class="py-2 px-2">
      <v-stepper class="vfa-stepper elevation-0">
        <v-stepper-header>
          <template v-for="(flow, index) in renderedAppFlow">
            <v-stepper-step
            :key="index"
            :step="index + 1"
            :color="isStepApproved(index) ? 'success' : 'red'"
            complete
            :class="['app-flow-step', isStepApproved(index) ? 'step-approved' : 'step-pending', isStepActive(index) ? 'step-active' : '']"
            >
            <v-tooltip bottom>
              <template #activator="{ on, attrs }">
                <div v-bind="attrs" v-on="on" class="d-flex flex-column align-start justify-center text-body-2" style="color: #4a4a4a; line-height: 1.3; font-weight: 400;">
                  <div class="mb-0.5" style="font-size: 11px; color: #8c8c8c; font-weight: 400;">
                    {{ ['mpr', 'mpr_flow2'].includes(appCode) ? customName(flow) : (flow.lvl_name ? flow.lvl_name[$i18n.locale] || flow.lvl_name.en : '') }}
                  </div>
                  <div style="font-size: 13px; color: #333333; font-weight: 500;">
                    {{ flow.manager_name_list_str }}
                  </div>
                  <div v-if="flow.deputy_name_list_str" style="font-size: 12px; color: #666666; font-weight: 400;">
                    {{ flow.deputy_name_list_str }}
                  </div>
                </div>
              </template>
              <div v-if="flow.not_deputy_name_list_str">
                {{ flow.not_deputy_name_list_str }}
              </div>
              <div v-else>{{ $t("no_disabled_deputy") }}</div>
            </v-tooltip>
          </v-stepper-step>
          <v-divider
          :key="index + 'divider'"
          v-if="index < appFlow.length - 1"
          />
        </template>
      </v-stepper-header>
    </v-stepper>
  </v-card-text>
</v-card>
</template>
<script>
export default {
  name: "AppFlow",
  props: {
    empno: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    appCode: {
      type: String,
      required: true,
    },
    customDept: {
      type: String,
      default: null,
    },
    customDivision: {
      type: String,
      default: null,
    },
    showFlow: {
      type: Boolean,
      default: true,
    },
    status: {
      type: [String, Array],
      default: null,
    },
  },
  data() {
    return {
      appFlow: [],
      show: true,
      deputyListArr: [],
    };
  },
  watch: {
    show(n) {
      if (!n) this.deputyListArr = [];
    },
    empno() {
      this.getFlow();
    },
    location() {
      this.getFlow();
    },
  },
  computed: {
    stepStatusList() {
      if (!this.status) return [];
      let parsed = [];
      if (typeof this.status === 'string') {
        try {
          parsed = JSON.parse(this.status);
        } catch (e) {
          console.error("Error parsing status in AppFlow:", e);
        }
      } else if (Array.isArray(this.status)) {
        parsed = this.status;
      }
      return parsed;
    },
    renderedAppFlow() {
      if (!Array.isArray(this.appFlow) || !this.appFlow.length) {
        return [];
      }
      return this.appFlow.reduce((res, cur) => {
        const managers = Array.isArray(cur.managers)
          ? cur.managers.filter((m) => m && m.empno)
          : [];
        
        // Identify which managers are actually deputies
        const isDeputyMap = {};
        managers.forEach((m) => {
          const isDep = m.is_deputy === true || managers.some((other) => 
            Array.isArray(other.deputies) && 
            other.deputies.some((d) => d.empno === m.empno && (d.status === true || d.status === 1 || d.status === 'true' || d.status === '1'))
          );
          if (isDep) {
            isDeputyMap[m.empno] = true;
          }
        });

        // Filter managers list into primary managers
        const primaryManagers = managers.filter(m => !isDeputyMap[m.empno]);

        const managerNameList = Object.values(
          primaryManagers.reduce((res1, cur1) => {
            if (!res1[cur1.empno]) {
              res1[cur1.empno] = cur1.name;
            }
            return res1;
          }, {})
        );

        const deputyList = managers.flatMap((x) =>
          Array.isArray(x.deputies)
            ? x.deputies.filter((d) => d && d.empno)
            : []
        );

        const t = {};
        const deputyNameList = Object.values(
          deputyList.reduce((res1, cur1) => {
            if (
              !res1[cur1.empno] &&
              cur1.status !== null &&
              cur1.status !== "" &&
              cur1.status !== false &&
              cur1.status !== undefined
            ) {
              res1[cur1.empno] = cur1.name;
            } else if (cur1.empno) {
              t[cur1.empno] = cur1.name;
            }
            return res1;
          }, {})
        );

        res.push({
          ...cur,
          manager_name_list_str: managerNameList.join(", "),
          deputy_name_list_str: deputyNameList.join(", "),
          not_deputy_name_list_str: Object.values(t).join(", "),
        });
        return res;
      }, []);
    },
  },
  mounted() {
    this.getFlow();
  },
  methods: {
    async getFlow() {
      if (!this.empno || !this.location || !this.appCode) {
        return;
      }
      let params = {
        empno: this.empno,
        app_code: this.appCode,
        location: this.location,
      };
      await this.$axios
      .post("/api/vgDormTest/getAppFlow", params)
      .then((res) => {
        if (res.data) {
          if (res.data.result && res.data.result.flow_data) {
            this.appFlow = res.data.result.flow_data;
          } else if (res.data.flow_data) {
            this.appFlow = res.data.flow_data;
          } else if (Array.isArray(res.data.result)) {
            this.appFlow = res.data.result;
          } else if (Array.isArray(res.data)) {
            this.appFlow = res.data;
          }
          this.$emit("sendAppFlow", this.appFlow);
        }
      })
      .catch((err) => {
        console.log(err);
      });
    },
    customName(flow) {
      const newLevelNames = {
        custom_dept_manager: { en: "Dept.", vi: "Chủ quản bộ phận", cn: "部級" },
        custom_division_manager: { en: "Div", vi: "Chủ quản cấp sở", cn: "處級" },
        dept_manager: { en: "Dept.", vi: "Chủ quản bộ phận", cn: "部級" },
        division_manager: { en: "Div.", vi: "Chủ quản cấp sở", cn: "處級" },
        hr_rec_sf: { en: "Recruitment team", vi: "Tổ tuyển dụng", cn: "招募組" },
        hr_manager: { en: "HR Dept.", vi: "Chủ Quản BP.HR", cn: "人資部" },
        smp_manager: { en: "AD Div.", vi: "Khu quản lý", cn: "管理處" },
        general_manager: { en: "GMO", vi: "VP.TGĐ", cn: "總經理室" }
      };
      const locale = this.$i18n.locale;
      const lvl = newLevelNames[flow.lvl_code];
      if (lvl && lvl[locale]) {
        return lvl[locale];
      }
      return flow.lvl_name ? flow.lvl_name[this.$i18n.locale] || flow.lvl_name.en : '';
    },
    isStepApproved(index) {
      const statusList = this.stepStatusList;
      if (!statusList || statusList.length === 0) return false;
      
      // If the request is fully approved (final step in status list is approved)
      const lastStatus = statusList[statusList.length - 1];
      const isFullyApproved = lastStatus && (lastStatus.stt === "accept" || lastStatus.gm === "true");
      if (isFullyApproved) return true;
      
      if (index < statusList.length) {
        const stepStatus = statusList[index];
        if (!stepStatus) return false;
        
        if (index === 0) return stepStatus.dept === "true" || stepStatus.stt === "accept";
        if (index === 1) return stepStatus.ga === "true" || stepStatus.stt === "accept";
        if (index === 2) return stepStatus.smp === "true" || stepStatus.stt === "accept";
        if (index === 3) return stepStatus.gm === "true" || stepStatus.stt === "accept";
      }
      
      return false;
    },
    isStepActive(index) {
      const statusList = this.stepStatusList;
      if (!statusList || statusList.length === 0) return false;
      
      if (statusList.some(s => s.stt === "deny")) return false;
      
      if (index === 0) {
        return statusList[0]?.dept === "false" && statusList[0]?.stt === "waiting dept";
      }
      if (index === 1) {
        return statusList[0]?.dept === "true" && statusList[0]?.stt === "accept" &&
               (statusList[1]?.ga === "false" || statusList[1]?.stt === "waiting ga");
      }
      if (index === 2) {
        return statusList[1]?.ga === "true" && statusList[1]?.stt === "accept" &&
               (statusList[2]?.smp === "false" || statusList[2]?.stt === "waiting smp");
      }
      if (index === 3) {
        return statusList[2]?.smp === "true" && statusList[2]?.stt === "accept" &&
               (statusList[3]?.gm === "false" || statusList[3]?.stt === "waiting gm");
      }
      
      return false;
    },
  },
};
</script>
<i18n>
  {
    "en":{
      "no_disabled_deputy": "No configured deputy"
    },
    "zh":{
      "no_disabled_deputy": "尚未配置替代人"
    },
    "vi":{
      "no_disabled_deputy": "Chưa cấu hình người thay thế"
    },
    "cn": {
      "no_disabled_deputy": "尚未配置替代人"
    }
  }
</i18n>
<style lang="scss">
.app-flow-card {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background-color: #fff;
}
.vfa-stepper {
  background: transparent !important;
}
.vfa-stepper .v-stepper__header {
  height: auto;
  min-height: auto;
  box-shadow: none !important;
  flex-wrap: nowrap;
  overflow-x: auto;
  align-items: center;
}
.vfa-stepper .v-stepper__step {
  padding: 6px 10px !important;
  flex-direction: row;
  align-items: center;
}
.vfa-stepper .v-stepper__step__step {
  margin-right: 8px !important;
  width: 26px;
  height: 26px;
  min-width: 26px;
  border-radius: 50%;
  border: 2px solid #fff !important;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.vfa-stepper .step-pending .v-stepper__step__step {
  background: linear-gradient(135deg, #ff5252 0%, #d32f2f 100%) !important;
  box-shadow: 0 3px 6px rgba(211, 47, 47, 0.3) !important;
}
.vfa-stepper .step-approved .v-stepper__step__step {
  background: linear-gradient(135deg, #66bb6a 0%, #2e7d32 100%) !important;
  box-shadow: 0 3px 6px rgba(46, 125, 50, 0.3) !important;
}
.vfa-stepper .step-pending:hover .v-stepper__step__step {
  transform: scale(1.1);
  box-shadow: 0 4px 10px rgba(211, 47, 47, 0.45) !important;
}
.vfa-stepper .step-approved:hover .v-stepper__step__step {
  transform: scale(1.1);
  box-shadow: 0 4px 10px rgba(46, 125, 50, 0.45) !important;
}
@keyframes pulse-animation {
  0% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(211, 47, 47, 0.7);
  }
  70% {
    transform: scale(1.06);
    box-shadow: 0 0 0 8px rgba(211, 47, 47, 0);
  }
  100% {
    transform: scale(1);
    box-shadow: 0 0 0 0 rgba(211, 47, 47, 0);
  }
}
.vfa-stepper .step-active .v-stepper__step__step {
  animation: pulse-animation 2s infinite ease-in-out;
  border: 2px solid #ff8a80 !important;
}
.vfa-stepper .v-stepper__step__step .v-icon {
  font-size: 15px !important;
  color: #fff !important;
}
.vfa-stepper .v-stepper__label {
  display: flex !important;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
}
.vfa-stepper .v-divider {
  margin: 0 !important;
  align-self: center;
  border-color: rgba(0, 0, 0, 0.12) !important;
}
</style>
