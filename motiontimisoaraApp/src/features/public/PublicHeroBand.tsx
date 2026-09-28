export function PublicHeroBand({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <div className="relative h-64 w-full overflow-hidden md:h-96">
      <img src={url} alt="" className="size-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  )
}
