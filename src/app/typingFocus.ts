const interactiveSelector = 'input, textarea, select, button, [contenteditable="true"]'

export function isCourseTypingTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('.editor-host') && !target.closest(interactiveSelector))
}
