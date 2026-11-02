export function PublicPageHeader({
  id,
  section,
  eyebrow,
  title,
  text,
}: {
  id: string
  section: string
  eyebrow: string
  title: string
  text: string
}) {
  return (
    <section
      aria-labelledby={id}
      data-section={section}
      className="from-primary/8 to-transparent border-b bg-gradient-to-b"
    >
      <div className="mx-auto max-w-7xl px-6 py-14">
        <span className="eyebrow mb-3">{eyebrow}</span>
        <h1 id={id} className="font-display text-foreground text-4xl font-extrabold lg:text-5xl">
          {title}
        </h1>
        <p className="text-muted-foreground mt-2">{text}</p>
      </div>
    </section>
  )
}
