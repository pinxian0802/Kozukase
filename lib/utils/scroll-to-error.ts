export function scrollToFirstError() {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>('[aria-invalid="true"]')
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 0)
}