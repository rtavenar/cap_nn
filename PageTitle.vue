<template>
  <span style="display: none">{{ v }}</span>
</template>
<script>
export default Vue.defineComponent({
  props: ["v"],
  mounted() {
    this.setTitle();
  },
  methods: {
    setTitle() {
      window.document.title = this.v;
    },
  },
  watch: {
    v(v) {
      this.setTitle();
    },
  },
});
</script>
