<i18n>
    {
        "en": {
            "appname": "Dormitory Management Application",
            "accessDenied": "You do not have permission to access this application.",
            "User manual": "User manual",
            "Go home": "Go home"
        },
        "cn": {
            "appname": "宿舍管理应用",
            "accessDenied": "您无权访问此应用程序。",
            "User manual": "用户手册",
            "Go home": "回家"
        },
        "vi": {
            "appname": "Ứng dụng quản lý ký túc xá",
            "accessDenied": "Bạn không được phép truy cập vào ứng dụng này.",
            "User manual": "Hướng dẫn sử dụng",
            "Go home": "Trang chủ"
        }
    }
</i18n>
<template>
    <div>
        <v-app v-if="loaded" dark>
            <v-navigation-drawer temporary color="teal" dark v-model="drawer" :mini-variant="miniVariant"
                :clipped="clipped" fixed app>
                <v-list>
                    <v-list-item v-for="(item, i) in items" :key="i"  :href="item.href" router exact>
                        <v-list-item-action>
                            <v-icon>{{ item.icon }}</v-icon>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title v-text="$t(item.title)" />
                        </v-list-item-content>
                    </v-list-item>
                </v-list>
            </v-navigation-drawer>
            <v-app-bar class="noPrint" dense color="teal" dark :clipped-left="clipped" fixed app>
                <v-app-bar-nav-icon @click.stop="drawer = !drawer" />
                <v-toolbar-title v-text="$t('appname')" />
                <v-chip class="ma-2" color="white" label small outlined @click:close="chip4 = false">
                    V.2.0
                </v-chip>

                <v-spacer />
                <v-btn @click="locale('vi')" text>VI</v-btn>
                <v-btn @click="locale('en')" text>EN</v-btn>
                <v-btn @click="locale('cn')" text class="mr-10">中文</v-btn>

                <label class="mr-5">
                    {{ this.$session.get("dma")
                        ? `${$t("Hi")}: ${this.$session.get("dma").name} - ${this.$session.get("dma").dept}`
                        : ""
                    }}
                </label>
            </v-app-bar>
            <v-main>
                <v-container fluid>
                    <nuxt />
                </v-container>
            </v-main>
            <!-- <v-footer class="noPrint" :absolute="!fixed" app>
                <small>&copy; {{ new Date().getFullYear() }} Developed by VG - Project
                    team</small>
                <v-spacer></v-spacer>

            </v-footer> -->
        </v-app>
        <AuthComp ref="authComp" app="dma" apiUrl="/api" @setUser="setUser" />
    </div>
</template>
<script>
 import AuthComp from "../../../@global-component/auth-comp";
// import AuthComp from 'D:/source/@global-component/auth-comp.vue';
export default {
    components: {
        AuthComp,
    },
    data() {
        return {
            apiGlobalUser: "/api/global-user/",
            loaded: false,
            clipped: false,
            drawer: false,
            fixed: false,
            miniVariant: false,
            right: true,
            rightDrawer: false,
            title: this.$t("appname"),
            activeUser: {},
            selectedCompany: null,
            userCompanies: [],
            companies: [
                { code: 'vg', label: 'VG' },
                { code: 'aw', label: 'AW' }
            ],
            isCompaniesLoaded: false,
            items: [
                {
                    icon: "mdi-apps",
                    title: "User manual",
                    href: "/shared/user-manual/dma/dma.pdf"
                },
                {
                    icon: "mdi-map-marker-radius",
                    title: "Go home",
                    href: "/"
                }
            ],
        };
    },
    methods: {
        selectCompany(company) {
            this.selectedCompany = company;
            this.$root.$emit('company-changed', company);
        },
        async setUser(user) {
            if (!user) return;

            // If it is already a mapped session object (emitted from AuthComp's existingData check)
            if (user.role && !user.app_roles) {
                this.loaded = true;
                await this.checkAppAccess(user.empno);
                return;
            }

            let role = null;
            if (user.app_roles) {
                try {
                    const appRoles = typeof user.app_roles === 'string' ? JSON.parse(user.app_roles) : user.app_roles;
                    const roleItem = Array.isArray(appRoles) ? appRoles.find(app => app.app === "dma") : null;
                    role = roleItem ? roleItem.role : null;
                } catch (e) {
                    console.error("Error parsing app_roles:", e);
                }
            }

            this.$session.set("dma", {
                id: user.id,
                empno: user.empno,
                name: user.name,
                username: user.username,
                dept: user.dept,
                hight_dept: user.high_dept,
                location: user.location,
                email: user.email,
                role: role,
                ext: user.extno,
                group: user.group_empno
            });
            this.loaded = true;
            console.log(this.$session.get("dma"));
            await this.checkAppAccess(user.empno);
        },

        locale(tg) {
            this.$i18n.setLocale(tg);
            $nuxt.$emit("change-locale", tg);
            this.$vuetify.lang.current = tg;
        },
        async checkAppAccess(empno) {
            const currentAppId = 40;

            try {
                const res = await this.$axios.post(this.apiGlobalUser + "checkAppAccess", { empno, app_id: currentAppId });
                if (res.status === 200 && res.data.status) {
                    if (res.data.data.length === 0) {
                        alert(`${this.$i18n.t('accessDenied', 'en')}\n ${this.$i18n.t('accessDenied', 'cn')}\n ${this.$i18n.t('accessDenied', 'vi')}`);
                        window.location.href = "/";
                    }
                    this.userCompanies = res.data.data.map(item => item.company.code);
                    if (!this.selectedCompany && this.userCompanies.length > 0) {
                        this.selectCompany(this.userCompanies[0]);
                    }
                }
            } catch (err) {
                console.error(err);
            }
        },
    },
    provide() {
        return {
            selectedCompanyValue: () => this.selectedCompany
        }
    },
    watch: {
        userCompanies(newVal) {
            if (newVal.length > 0 && !this.selectedCompany) {
                this.selectCompany(newVal[0]);
            }
            this.isCompaniesLoaded = true;
        }
    },
    computed: {},
    mounted() {

        if (this.$session.has("dma")) {
            this.activeUser = this.$session.get("dma");
            if (this.activeUser) {
                this.loaded = true;
                this.checkAppAccess(this.activeUser.empno);
            } else {
                this.loaded = false;
            }

        } else {
            this.$router.push({
                path: "/",
            });
        }
    },
};
</script>
