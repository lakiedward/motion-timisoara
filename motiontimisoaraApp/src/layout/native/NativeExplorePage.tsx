import { discoveryNavigation } from './navigation-model'
import { NativeLinkGroup } from './NativeLinkGroup'

export default function NativeExplorePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-6">
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold">Descoperă următoarea aventură</h1>
        <p className="text-muted-foreground text-sm">
          Cursuri, activități, tabere și concursuri pentru copilul tău.
        </p>
      </div>
      <NativeLinkGroup title="Sport și comunitate" items={discoveryNavigation} />
    </div>
  )
}
