export default function PortalComingSoon({ title }: { title: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-foreground">{title}</h1>
      <div className="text-muted-foreground mt-6 rounded-3xl border border-dashed py-16 text-center">
        Disponibil în curând.
      </div>
    </div>
  )
}
