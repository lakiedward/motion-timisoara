import { HomeBenefits } from './home/HomeBenefits'
import { HomeFinalCta } from './home/HomeFinalCta'
import { HomeHero } from './home/HomeHero'
import { HomePrograms } from './home/HomePrograms'
import { HomeTestimonials } from './home/HomeTestimonials'

export default function HomePage() {
  return (
    <>
      <HomeHero />
      <HomeBenefits />
      <HomePrograms />
      <HomeTestimonials />
      <HomeFinalCta />
    </>
  )
}
