export function FieldError({ children, id }) {
  if (!children) return null
  return <p id={id} role="alert" className="mt-1 text-xs text-danger">{children}</p>
}
