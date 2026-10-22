export function CoachAvatar({ nume, pozaUrl }: { nume: string; pozaUrl: string | null }) {
  return pozaUrl ? (
    <img src={pozaUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
  ) : (
    <span className="bg-muted flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-medium">
      {nume.charAt(0)}
    </span>
  )
}
