const ACTIVITATE_PREVIEW = '74a9d327-fb4e-450f-866f-f24575edc204'

const DESCRIERE_PREVIEW = [
  'Siguranță și îndemânare pe bicicletă.',
  'Atelierul este pentru copii care vor să învețe cum se stă pe bicicletă, cum se frânează și cum se uită în jur înainte de a porni. Lucrăm pe iarba din parc, cu cască și cu un traseu scurt, marcat.',
  'În prima parte verificăm șaua, ghidonul și frânele. Apoi exersăm pornirea, oprirea și virajul, pe rând, ca fiecare copil să aibă loc. La final facem un tur scurt împreună și vorbim despre ce a mers bine.',
  'Copilul are nevoie de bicicletă, cască și apă. Dacă nu are cască, spunem din timp și vedem ce putem împrumuta. Părintele poate rămâne la margine pe toată durata.',
].join('\n\n')

const POZE_PREVIEW = [
  '/ui/20210405_152345.webp',
  '/ui/20230516_184053.webp',
  'https://ehdzafadshbaaghzdzdo.supabase.co/storage/v1/object/public/camp-photos/4ffa9682-6dc0-49e5-b466-30097d72869c/gallery/00c3460b-6afe-4719-ab49-380a6dcebbf8.jpg',
  'https://ehdzafadshbaaghzdzdo.supabase.co/storage/v1/object/public/camp-photos/4ffa9682-6dc0-49e5-b466-30097d72869c/gallery/2fbdbfc2-3b89-4d7f-a0fd-bca64d6f0f4c.jpg',
  'https://ehdzafadshbaaghzdzdo.supabase.co/storage/v1/object/public/camp-photos/4ffa9682-6dc0-49e5-b466-30097d72869c/gallery/31664227-a281-4e5f-a3d4-f33a6e9d4514.jpg',
]

export function descriereActivitatePreview(id: string, description: string | null): string | null {
  if (id !== ACTIVITATE_PREVIEW) return description
  return DESCRIERE_PREVIEW
}

export function pozeActivitatePreview(id: string, urls: string[]): string[] {
  if (id !== ACTIVITATE_PREVIEW) return urls
  const toate = [...urls]
  for (const url of POZE_PREVIEW) {
    if (!toate.includes(url)) toate.push(url)
  }
  return toate
}
