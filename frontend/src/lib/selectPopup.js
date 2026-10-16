/**
 * Native <select> popup → our own list (2026-10-16, user: "jitne bhi dropdown
 * aate h ese aaye" — white panel, roomy 44px rows, light grey hover).
 *
 * Chrome / Electron draw a <select>'s open list themselves (an OS menu on
 * macOS) and CSS can't style it, so this intercepts the open and renders
 * `.dsel-pop` instead. The <select> stays untouched in the DOM; picking a
 * row sets its value through the native setter and fires input + change,
 * so React's onChange runs as usual. Same idea / class names as billing's
 * public/js/dark-select.js. Opt out per select with data-native-select.
 */
const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set

let openPopup = null
let openSelect = null

const skip = (select) => select.multiple || select.disabled || select.hasAttribute('data-native-select')

function onAnyScroll(e) {
  if (openPopup && e?.target?.nodeType === 1 && openPopup.contains(e.target)) return
  close()
}
function onOutside(e) {
  if (openPopup && !openPopup.contains(e.target) && e.target !== openSelect) close()
}
function onKey(e) {
  if (e.key === 'Escape') close()
}

function close() {
  openPopup?.remove()
  openPopup = null
  openSelect = null
  window.removeEventListener('scroll', onAnyScroll, true)
  window.removeEventListener('resize', close, true)
  document.removeEventListener('mousedown', onOutside, true)
  document.removeEventListener('touchstart', onOutside, true)
  document.removeEventListener('keydown', onKey, true)
}

function choose(select, opt) {
  if (opt.disabled) return
  if (valueSetter) valueSetter.call(select, opt.value)
  else select.value = opt.value
  select.dispatchEvent(new Event('input', { bubbles: true }))
  select.dispatchEvent(new Event('change', { bubbles: true }))
  close()
  select.focus()
}

function build(select) {
  const pop = document.createElement('div')
  pop.className = 'dsel-pop'
  const list = document.createElement('div')
  list.className = 'dsel-list'
  if (select.options.length >= 12) {
    const q = document.createElement('input')
    q.className = 'dsel-q'
    q.placeholder = 'Search…'
    q.setAttribute('data-vk-ignore', '')
    q.addEventListener('mousedown', (e) => e.stopPropagation())
    q.addEventListener('input', () => {
      const t = q.value.trim().toLowerCase()
      Array.from(list.children).forEach((it) => { it.style.display = !t || it.textContent.toLowerCase().includes(t) ? '' : 'none' })
    })
    q.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      e.preventDefault()
      const first = Array.from(list.children).find((it) => it.style.display !== 'none' && !it.classList.contains('is-disabled'))
      first?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    pop.appendChild(q)
    setTimeout(() => q.focus(), 0)
  }
  Array.from(select.options).forEach((opt) => {
    if (opt.hidden) return
    const item = document.createElement('div')
    item.className = `dsel-item${opt.selected ? ' is-sel' : ''}${opt.disabled ? ' is-disabled' : ''}`
    item.textContent = opt.text
    if (!opt.disabled) {
      item.addEventListener('mousedown', (e) => { e.preventDefault(); choose(select, opt) })
    }
    list.appendChild(item)
  })
  pop.appendChild(list)
  return pop
}

function open(select) {
  close()
  const rect = select.getBoundingClientRect()
  const pop = build(select)
  Object.assign(pop.style, { position: 'fixed', left: `${rect.left}px`, top: `${rect.bottom + 4}px`, minWidth: `${rect.width}px` })
  // inside a dialog → mount there so its focus trap doesn't fight the search box
  const host = select.closest('[role="dialog"], [role="presentation"]') || document.body
  host.appendChild(pop)

  const listEl = pop.querySelector('.dsel-list')
  const below = window.innerHeight - rect.bottom - 16
  const above = rect.top - 16
  listEl.style.maxHeight = `${Math.max(140, Math.min(320, Math.max(below, above)))}px`
  const pr = pop.getBoundingClientRect()
  if (pr.bottom > window.innerHeight) pop.style.top = `${Math.max(4, rect.top - pr.height - 4)}px`
  if (pr.right > window.innerWidth) pop.style.left = `${Math.max(4, window.innerWidth - pr.width - 4)}px`
  const sel = listEl.querySelector('.is-sel')
  if (sel) listEl.scrollTop = Math.max(0, sel.offsetTop - listEl.clientHeight / 2 + 22)

  openPopup = pop
  openSelect = select
  window.addEventListener('scroll', onAnyScroll, true)
  window.addEventListener('resize', close, true)
  document.addEventListener('keydown', onKey, true)
  setTimeout(() => {
    document.addEventListener('mousedown', onOutside, true)
    document.addEventListener('touchstart', onOutside, true)
  }, 0)
}

// one delegated listener — works for selects React adds / re-renders later
document.addEventListener('mousedown', (e) => {
  const select = e.target?.closest?.('select')
  if (!select || skip(select)) return
  e.preventDefault()
  select.focus()
  if (openSelect === select) close()
  else open(select)
}, true)

document.addEventListener('keydown', (e) => {
  const select = e.target
  if (!(select instanceof HTMLSelectElement) || skip(select) || openSelect === select) return
  if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key) && !e.altKey) {
    e.preventDefault()
    open(select)
  }
}, true)
