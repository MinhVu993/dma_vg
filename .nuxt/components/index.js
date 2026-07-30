export const AppFlow = () => import('../../components/AppFlow.vue' /* webpackChunkName: "components/app-flow" */).then(c => wrapFunctional(c.default || c))
export const DsFilter = () => import('../../components/DsFilter.vue' /* webpackChunkName: "components/ds-filter" */).then(c => wrapFunctional(c.default || c))
export const Auth = () => import('../../components/auth.vue' /* webpackChunkName: "components/auth" */).then(c => wrapFunctional(c.default || c))

// nuxt/nuxt.js#8607
function wrapFunctional(options) {
  if (!options || !options.functional) {
    return options
  }

  const propKeys = Array.isArray(options.props) ? options.props : Object.keys(options.props || {})

  return {
    render(h) {
      const attrs = {}
      const props = {}

      for (const key in this.$attrs) {
        if (propKeys.includes(key)) {
          props[key] = this.$attrs[key]
        } else {
          attrs[key] = this.$attrs[key]
        }
      }

      return h(options, {
        on: this.$listeners,
        attrs,
        props,
        scopedSlots: this.$scopedSlots,
      }, this.$slots.default)
    }
  }
}
