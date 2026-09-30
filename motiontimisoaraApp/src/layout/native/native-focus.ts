const fieldsSelector =
  'input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'
const nonEditableInputTypes = new Set([
  'hidden',
  'button',
  'submit',
  'reset',
  'checkbox',
  'radio',
  'file',
  'image',
  'color',
  'range',
])

function isEditableField(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement) || element.hidden || element.tabIndex < 0) return false
  if (element instanceof HTMLInputElement) {
    return !element.disabled && !element.readOnly && !nonEditableInputTypes.has(element.type)
  }
  if (element instanceof HTMLTextAreaElement) return !element.disabled && !element.readOnly
  if (element instanceof HTMLSelectElement) return !element.disabled
  return element.isContentEditable
}

export function revealNativeInput(container: HTMLElement, keyboardVisible: boolean) {
  const active = document.activeElement
  if (!active || !container.contains(active) || !isEditableField(active)) return

  const bounds = container.getBoundingClientRect()
  const viewport = window.visualViewport
  const styles = getComputedStyle(container)
  const top =
    Math.max(bounds.top, viewport?.offsetTop ?? bounds.top) +
    (parseFloat(styles.scrollPaddingTop) || 0)
  const bottom =
    Math.min(bounds.bottom, viewport ? viewport.offsetTop + viewport.height : bounds.bottom) -
    (parseFloat(styles.scrollPaddingBottom) || 0)
  const available = bottom - top
  if (available <= 0) return

  const activeBounds = active.getBoundingClientRect()
  if (activeBounds.width <= 0 || activeBounds.height <= 0) return
  let start = activeBounds.top
  let end = activeBounds.bottom

  if (keyboardVisible) {
    const scope = active.closest('form') ?? container
    const fields = Array.from(scope.querySelectorAll(fieldsSelector))
      .filter(isEditableField)
      .map((field) => ({ field, rect: field.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0)
    const index = fields.findIndex(({ field }) => field === active)
    const neighbors = fields
      .map(({ rect }, position) => ({
        rect,
        distance: Math.abs(position - index),
        forward: position > index,
      }))
      .filter(({ distance }) => distance > 0)
      .sort((a, b) => a.distance - b.distance || Number(b.forward) - Number(a.forward))
    const include = (fieldTop: number, fieldBottom: number) => {
      const unionTop = Math.min(start, fieldTop)
      const unionBottom = Math.max(end, fieldBottom)
      if (unionBottom - unionTop > available) return
      start = unionTop
      end = unionBottom
    }
    for (const { rect } of neighbors) {
      const center = (rect.top + rect.bottom) / 2
      include(center, center)
    }
    for (const { rect } of neighbors) {
      include(rect.top, rect.bottom)
    }
  }

  const delta =
    end - start > available || start < top ? start - top : end > bottom ? end - bottom : 0
  if (delta === 0) return
  const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
  container.scrollTop = Math.min(maxScroll, Math.max(0, container.scrollTop + delta))
}
