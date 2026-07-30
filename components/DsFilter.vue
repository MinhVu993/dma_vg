<template>
    <v-menu v-model="show" :close-on-content-click="false" offset-x tile>
        <template #activator="{ attrs, on }">
            <span v-bind="attrs" v-on="on" class="filter-header">
                {{ name }}
                <v-badge v-if="selected.length" 
                class="badge" 
                :content="selected.length" 
                offset-y="5" 
                offset-x="9" 
                color="orange" 
                dark>
                <v-icon small color="error">{{mdiFilter}}</v-icon>
            </v-badge>
            <v-icon v-else small>{{mdiFilter}}</v-icon>
        </span>
    </template>
    <v-card>
        <v-autocomplete
        ref="autocomplete"
        v-model="selected"
        :items="filteredItems"
        :search-input.sync="searchQuery"
        :label="$t('Search')"
        multiple
        chips
        clearable
        dense
        hide-details
        autofocus
        class="px-2 pt-2"
        @click:clear="clearFilter"
        @keyup.enter="handleEnterKey"
        >
        <template v-slot:selection="{ item, index }">
            <v-chip v-if="index < 2" small>
                {{ item }}
            </v-chip>
            <span v-else-if="index === 2" class="grey--text caption">
                (+{{ selected.length - 2 }})
            </span>
        </template>
    </v-autocomplete>
    <v-divider class="mt-2"></v-divider>
    <v-card-actions>
        <v-spacer></v-spacer>
        <v-btn small text @click="clearFilter">
            {{ $t('Clear') }}
        </v-btn>
        <v-btn small color="primary" text @click="show = false">
            {{ $t('Close') }}
        </v-btn>
    </v-card-actions>
</v-card>
</v-menu>
</template>

<script>
import { mdiFilter } from '@mdi/js'

export default {
    name: 'DsFilter',
    props: {
        inItems: {
            type: Array,
            default: () => [],
        },
        name: {
            type: String,
            required: true,
        },
    },
    data() {
        return {
            show: false,
            selected: [],
            mdiFilter,
            searchQuery: null,
        }
    },
    computed: {
        filteredItems() {
            if (!this.searchQuery) return this.inItems;
            
            const query = this.searchQuery.toLowerCase().trim();
            return this.inItems.filter(item => 
            String(item).toLowerCase().includes(query)
            );
        }
    },
    watch: {
        inItems: {
            handler(newItems) {
                if (this.selected && this.selected.length > 0) {
                    const validSelections = this.selected.filter(item => newItems.includes(item));
                    if (validSelections.length !== this.selected.length) {
                        this.selected = validSelections;
                    }
                }
            },
            deep: true
        },
        show(val) {
            if (val) {
                this.$nextTick(() => {
                    this.$refs.autocomplete.focus();
                });
            }
        },
        // We removed the auto-select on searchQuery change to make it a standard filter
        selected(newVal) {
            this.$emit('changed', newVal)
        },
    },
    methods: {
        clearFilter() {
            this.selected = [];
            this.searchQuery = null;
        },
        handleEnterKey() {
            if (!this.searchQuery) return;
            
            const query = this.searchQuery.toLowerCase().trim();
            if (query) {
                const matchedItems = this.inItems.filter(item =>
                String(item).toLowerCase().includes(query)
                );
                
                // Add matched items to existing selection without removing others
                const newSelections = [...this.selected];
                matchedItems.forEach(item => {
                    if (!newSelections.includes(item)) {
                        newSelections.push(item);
                    }
                });
                
                this.selected = newSelections;
                this.show = false;
                this.searchQuery = null;
            }
        }
    },
}
</script>

<i18n>
    {
        "en": {
            "Search": "Search",
            "Clear": "Clear",
            "Close": "Close"
        },
        "cn": {
            "Search": "搜索",
            "Clear": "清除",
            "Close": "关闭"
        },
        "vi": {
            "Search": "Tìm kiếm",
            "Clear": "Xóa",
            "Close": "Đóng"
        }
    }
</i18n>
<style scoped>
.v-autocomplete ::v-deep .v-chip {
    margin: 2px;
}

.v-autocomplete ::v-deep .v-chip--small {
    height: 20px;
}

.filter-active {
    background-color: #E3F2FD;
}
</style>