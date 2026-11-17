/** The brief asks for a blank Home tab. Only a header, so the shell looks consistent. */
export function HomeTab() {
  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pt-4 pb-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Home</h1>
      </header>
    </div>
  )
}
