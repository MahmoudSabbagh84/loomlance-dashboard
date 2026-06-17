export function AuthShell({ children }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-4 py-12">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-primary)_22%,transparent),transparent_70%)] blur-2xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 translate-x-1/3 translate-y-1/3 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-accent)_16%,transparent),transparent_70%)] blur-2xl" />
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}
