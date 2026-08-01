function waitForStableDom(container = document.body, { quietPeriodMs = 300, timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    let quietTimer = null
    let settled = false

    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(quietTimer)
      clearTimeout(hardTimeout)
      observer.disconnect()
      resolve()
    }

    const observer = new MutationObserver(() => {
      clearTimeout(quietTimer)
      quietTimer = setTimeout(finish, quietPeriodMs)
    })

    observer.observe(container, { childList: true, subtree: true, attributes: true })

    quietTimer = setTimeout(finish, quietPeriodMs)
    const hardTimeout = setTimeout(finish, timeoutMs)
  })
}

async function clickAndWait(el, { scopeEl = document.body, ...waitOptions } = {}) {
  el.click()
  await waitForStableDom(scopeEl, waitOptions)
}

export { waitForStableDom, clickAndWait }
