export function vtNavigate(navigate: () => void) {
  const anyDoc = document as any
  if (typeof anyDoc.startViewTransition === 'function') {
    anyDoc.startViewTransition(() => {
      navigate()
    })
  } else {
    navigate()
  }
}
