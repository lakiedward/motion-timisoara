import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import {
  MAX_DESCRIERE_POZA,
  schimbaDescrierePoza,
  type PozaGalerie,
  type TabelGalerie,
} from '@/api/photo-gallery'
import { Input } from '@/components/ui/input'

export function GalleryPhotoCaption({
  tabel,
  poza,
  index,
  placeholder,
  onSaved,
}: {
  tabel: TabelGalerie
  poza: PozaGalerie
  index: number
  placeholder: string
  onSaved: () => void
}) {
  const salvata = poza.caption ?? ''
  const [text, setText] = useState(salvata)

  const salveaza = useMutation({
    mutationFn: (valoare: string) => schimbaDescrierePoza(tabel, poza.id, valoare),
    onSuccess: () => {
      toast.success('Descriere salvată.')
      onSaved()
    },
    onError: () => {
      toast.error('Nu am putut salva descrierea.')
      setText(salvata)
    },
  })

  const trimite = () => {
    if (text.trim() !== salvata) salveaza.mutate(text)
  }

  return (
    <Input
      value={text}
      maxLength={MAX_DESCRIERE_POZA}
      placeholder={placeholder}
      aria-label={`Descrierea pozei ${index + 1}`}
      disabled={salveaza.isPending}
      onChange={(e) => setText(e.target.value)}
      onBlur={trimite}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        e.preventDefault()
        e.currentTarget.blur()
      }}
    />
  )
}
