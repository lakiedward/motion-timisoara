import { useQuery } from '@tanstack/react-query'

import { getHomeTestimonials } from '@/api/home'

const MIN_TESTIMONIALS = 2

export function HomeTestimonials() {
  const { data } = useQuery({ queryKey: ['home', 'testimonials'], queryFn: getHomeTestimonials })
  if (!data || data.length < MIN_TESTIMONIALS) return null

  return (
    <section aria-labelledby="home-testimonials-title" className="mx-auto max-w-7xl px-6 py-20 md:py-24">
      <div className="mb-10 max-w-2xl">
        <span className="eyebrow mb-3">Părinții spun</span>
        <h2
          id="home-testimonials-title"
          className="font-display text-foreground text-3xl font-extrabold md:text-4xl"
        >
          Din evaluările părinților
        </h2>
      </div>
      <ul className="grid gap-4 md:grid-cols-3">
        {data.map((testimonial) => (
          <li key={testimonial.id} className="bg-card rounded-xl border p-6">
            <figure className="flex h-full flex-col">
              <blockquote className="text-foreground flex-1 text-base leading-relaxed">
                „{testimonial.quote}”
              </blockquote>
              <figcaption className="mt-5 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="bg-accent text-accent-foreground grid size-10 place-items-center rounded-full font-bold"
                >
                  {testimonial.author.charAt(0)}
                </span>
                <span>
                  <span className="text-foreground block text-sm font-semibold">{testimonial.author}</span>
                  <span className="text-muted-foreground block text-sm">Părinte</span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  )
}
