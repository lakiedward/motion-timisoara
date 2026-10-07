type LocationTypeGroup = {
  label: string
  options: readonly { value: string; label: string }[]
}

export const locationTypeGroups: readonly LocationTypeGroup[] = [
  {
    label: 'Bazine și apă',
    options: [
      { value: 'POOL', label: 'Bazin' },
      { value: 'INDOOR_POOL', label: 'Bazin interior' },
      { value: 'OUTDOOR_POOL', label: 'Bazin exterior' },
      { value: 'OPEN_WATER', label: 'Apă deschisă (lac, râu)' },
    ],
  },
  {
    label: 'Terenuri și piste',
    options: [
      { value: 'TRACK', label: 'Pistă de atletism' },
      { value: 'FOOTBALL_FIELD', label: 'Teren de fotbal' },
      { value: 'BASKETBALL_COURT', label: 'Teren de baschet' },
      { value: 'TENNIS_COURT', label: 'Teren de tenis' },
      { value: 'PADEL_COURT', label: 'Teren de padel' },
      { value: 'VOLLEYBALL_COURT', label: 'Teren de volei' },
      { value: 'HANDBALL_COURT', label: 'Teren de handbal' },
      { value: 'MULTISPORT_COURT', label: 'Teren multisport' },
      { value: 'STADIUM', label: 'Stadion' },
    ],
  },
  {
    label: 'Săli',
    options: [
      { value: 'GYM', label: 'Sală de sport' },
      { value: 'FITNESS_GYM', label: 'Sală de fitness' },
      { value: 'SPORTS_HALL', label: 'Sală polivalentă' },
      { value: 'CLIMBING_GYM', label: 'Sală de escaladă' },
      { value: 'MARTIAL_ARTS_GYM', label: 'Sală de arte marțiale' },
      { value: 'DANCE_STUDIO', label: 'Sală de dans' },
    ],
  },
  {
    label: 'Aer liber',
    options: [
      { value: 'PARK', label: 'Parc' },
      { value: 'RUNNING_TRAIL', label: 'Traseu de alergare' },
      { value: 'CYCLING_ROUTE', label: 'Traseu de ciclism' },
      { value: 'OUTDOOR_AREA', label: 'Spațiu în aer liber' },
    ],
  },
  { label: 'Altă locație', options: [{ value: 'OTHER', label: 'Alt tip' }] },
]

export function locationTypeLabel(type: string): string {
  return (
    locationTypeGroups.flatMap((group) => group.options).find((option) => option.value === type)
      ?.label ?? type
  )
}
