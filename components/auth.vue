<template> </template>
<script>
export default {
  data() {
    return {};
  },
  beforeMount() {
    if (!this.$session.has("dma")) {
      this.$router.push("./");
    }
  }
};
</script>