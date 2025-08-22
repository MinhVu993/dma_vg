<template>
  <v-menu v-model="show" :close-on-content-click="false" offset-x tile>
    <template #activator="{ attrs, on }">
      <span v-bind="attrs" v-on="on">
        {{ name }}
        <v-badge v-if="selected.length" class="badge" :content="selected.length" offset-y="5" offset-x="9" color="orange" dark>
          <v-icon small color="error">{{mdiFilter}}</v-icon>
        </v-badge>
        <v-icon v-else small >{{mdiFilter}}</v-icon>
      </span>
    </template>
    <v-autocomplete clearable  color="error" v-model="selected" class="autocomplete" :items="inItems" hide-details autofocus multiple dense @focus="$event.target.click()" style="max-width:150px;" />
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
  watch: {
    selected(n) {
      this.$emit('changed', n)
    },
  },
  data() {
    return {
      show: false,
      selected: [],
      mdiFilter,
    }
  },
}
</script>
