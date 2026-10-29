<template>
  <v-app>
    <notifications position="bottom right" animation-type="velocity" />
    <v-main style="background: url(bg4.jpg) top center no-repeat; background-size: cover;"> 
      <VersionChecker app-name="dma"></VersionChecker>
      <v-container class="fill-height" fluid>
        <nuxt />
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
import VersionChecker from "../../../@global-component/version-checker";
// import VersionChecker from 'D:/source/@global-component/version-checker.vue'
export default {
  components: {
    VersionChecker,
  },
  data () {
    return {
      
    }
  }
}
</script>
