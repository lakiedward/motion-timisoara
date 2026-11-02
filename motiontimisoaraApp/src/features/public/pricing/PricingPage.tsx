import { useSearchParams } from 'react-router-dom'

import { PricingDirectionA } from './PricingDirectionA'
import { PricingDirectionB } from './PricingDirectionB'

export default function PricingPage() {
  const [params] = useSearchParams()
  return params.get('directie') === 'b' ? <PricingDirectionB /> : <PricingDirectionA />
}
