<template>
    <div>
        <v-dialog v-model="dialog" fullscreen hide-overlay transition="dialog-bottom-transition">
            <v-card>
                <v-toolbar dark color="teal darken-2" dense flat>
                    <v-btn icon dark @click="closeDialog">
                        <v-icon>mdi-close</v-icon>
                    </v-btn>
                    <v-toolbar-title class="text-subtitle-1">
                        {{ $t('Tenant Registration Form') }}
                    </v-toolbar-title>
                    <v-spacer></v-spacer>
                    <v-toolbar-items>
                        <v-btn dark text small>
                            <v-icon small left>mdi-content-save</v-icon>
                            {{ $t('Save') }}
                        </v-btn>
                    </v-toolbar-items>
                </v-toolbar>

                <v-card flat class="pa-2">
                    <v-card-text>
                            <v-row dense>
                                <v-col cols="12">
                                    <div class="text-subtitle-2 teal--text mb-2">{{ $t('Personal Information') }}</div>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-text-field v-model="formData.fullName" :label="$t('Full Name')"
                                        prepend-inner-icon="mdi-account" dense outlined hide-details="auto"
                                        class="mb-2"></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-text-field v-model="formData.birthYear" :label="$t('Birth Year')"
                                        prepend-inner-icon="mdi-calendar" type="number" dense outlined
                                        hide-details="auto" class="mb-2"></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-select v-model="formData.gender" :items="genderOptions" :label="$t('Gender')"
                                        prepend-inner-icon="mdi-gender-male-female" dense outlined hide-details="auto"
                                        class="mb-2"></v-select>
                                </v-col>

                                <v-col cols="12" sm="6" md="4">
                                    <v-text-field v-model="formData.idCard" :label="$t('ID Card')"
                                        prepend-inner-icon="mdi-card-account-details" dense outlined hide-details="auto"
                                        class="mb-2"></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-text-field v-model="formData.nationality" :label="$t('Nationality')"
                                        prepend-inner-icon="mdi-flag" dense outlined hide-details="auto"
                                        class="mb-2"></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-select v-model="formData.maritalStatus" :items="maritalStatusOptions"
                                        :label="$t('Marital Status')" prepend-inner-icon="mdi-heart" dense outlined
                                        hide-details="auto" class="mb-2"></v-select>
                                </v-col>

                                <v-col cols="12">
                                    <div class="text-subtitle-2 teal--text mb-2">{{ $t('Contact Information') }}</div>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-text-field v-model="formData.address" :label="$t('Permanent Address')"
                                        prepend-inner-icon="mdi-home" dense outlined hide-details="auto"
                                        class="mb-2"></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-text-field v-model="formData.phone" :label="$t('Phone Number')"
                                        prepend-inner-icon="mdi-phone" dense outlined hide-details="auto"
                                        class="mb-2"></v-text-field>
                                </v-col>
                                <v-col cols="12" sm="6" md="4">
                                    <v-menu v-model="dateMenu" :close-on-content-click="false" offset-y
                                        min-width="290px">
                                        <template v-slot:activator="{ on, attrs }">
                                            <v-text-field v-model="formData.moveInDate" :label="$t('Move-in Date')"
                                                prepend-inner-icon="mdi-calendar-check" readonly v-bind="attrs"
                                                v-on="on" dense outlined hide-details="auto"
                                                class="mb-2"></v-text-field>
                                        </template>
                                        <v-date-picker v-model="formData.moveInDate" @input="dateMenu = false"
                                            color="teal" no-title scrollable></v-date-picker>
                                    </v-menu>
                                </v-col>
                                <v-col cols="12">
                                    <v-textarea v-model="formData.notes" :label="$t('Notes')"
                                        prepend-inner-icon="mdi-note-text" dense outlined hide-details="auto" rows="2"
                                        class="mb-2"></v-textarea>
                                </v-col>
                            </v-row>
                    </v-card-text>
                </v-card>
            </v-card>
        </v-dialog>
    </div>
</template>
<script>
import dayjs, { Dayjs } from "dayjs";
import auth from "~/components/auth";
// import VfaAppFlow from "../../../../@global-component/vfa-updated2"; //vfa-app-flow
export default {
    name: 'request', // Thêm name để định danh component
    props: {
        value: {
            type: Boolean,
            default: false
        }
    },
    components: { auth },
    data() {
        return {
            dialog: false,
            dateMenu: false,
            activeUser: {
                empno: '',
                name: '',
                dept: '',
                hight_dept: ''
            },
            formData: {
                fullName: '',
                birthYear: '',
                gender: '',
                idCard: '',
                nationality: '',
                maritalStatus: '',
                address: '',
                phone: '',
                moveInDate: '',
                notes: ''
            },
            genderOptions: [
                { text: this.$t('Male'), value: 'male' },
                { text: this.$t('Female'), value: 'female' },
                { text: this.$t('Other'), value: 'other' }
            ],
            maritalStatusOptions: [
                { text: this.$t('Single'), value: 'single' },
                { text: this.$t('Married'), value: 'married' },
                { text: this.$t('Divorced'), value: 'divorced' },
                { text: this.$t('Widowed'), value: 'widowed' }
            ]
        };
    },
    methods: {
        closeDialog() {
            this.$emit('close');
        }
    },
    watch: {
        value(val) {
            this.dialog = val;
        },
        dialog(val) {
            if (!val) {
                this.$emit('input', val);
            }
        }
    },
    created() { },
    mounted() {

    },
};
</script>
<style scoped>
.v-text-field>>>.v-input__control .v-input__slot,
.v-select>>>.v-input__control .v-input__slot,
.v-textarea>>>.v-input__control .v-input__slot {
    min-height: 40px !important;
}

.v-text-field>>>.v-input__prepend-inner {
    margin-top: 4px !important;
}

.text-subtitle-2 {
    font-size: 0.9rem !important;
    font-weight: 500;
}
</style>
<i18n>
    {
        "en": {
            "Full Name": "Full Name",
            "Birth Year": "Birth Year",
            "Gender": "Gender",
            "ID Card": "ID Card",
            "Nationality": "Nationality",
            "Marital Status": "Marital Status",
            "Permanent Address": "Permanent Address",
            "Phone Number": "Phone Number",
            "Move-in Date": "Move-in Date",
            "Notes": "Notes",
            "Male": "Male",
            "Female": "Female",
            "Other": "Other",
            "Single": "Single",
            "Married": "Married",
            "Divorced": "Divorced",
            "Widowed": "Widowed",
            "Tenant Registration Form": "Tenant Registration Form",
            "Personal Information": "Personal Information",
            "Contact Information": "Contact Information"
        },
        "vi": {
            "Full Name": "Họ tên",
            "Birth Year": "Năm sinh",
            "Gender": "Giới tính",
            "ID Card": "CCCD",
            "Nationality": "Quốc tịch",
            "Marital Status": "Tình trạng hôn nhân",
            "Permanent Address": "Địa chỉ thường trú",
            "Phone Number": "Số điện thoại",
            "Move-in Date": "Ngày vào ở",
            "Notes": "Ghi chú",
            "Male": "Nam",
            "Female": "Nữ",
            "Other": "Khác",
            "Single": "Độc thân",
            "Married": "Đã kết hôn",
            "Divorced": "Ly hôn",
            "Widowed": "Góa",
            "Tenant Registration Form": "Đơn Đăng Ký Người Thuê",
            "Personal Information": "Thông Tin Cá Nhân",
            "Contact Information": "Thông Tin Liên Hệ"
        },
        "cn": {
            
        }
    }
</i18n>