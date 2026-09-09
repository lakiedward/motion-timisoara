import { SharingController } from './sharing-controller'

export class SharingRegistry {
  private controllers = new Map<string | null, SharingController>()
  private listeners = new Set<() => void>()
  private version = 0
  private create: (actorId: string | null) => SharingController
  constructor(create: (actorId: string | null) => SharingController) {
    this.create = create
  }
  getSnapshot = () => this.version
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
  forActor(actorId: string | null) {
    let controller = this.controllers.get(actorId)
    if (!controller) {
      controller = this.create(actorId)
      controller.subscribe(() => {
        ++this.version
        this.listeners.forEach((notify) => notify())
      })
      this.controllers.set(actorId, controller)
    }
    return controller
  }
  pendingExcept(current: SharingController) {
    return [...this.controllers.values()].filter((controller) => {
      const state = controller.getSnapshot()
      return controller !== current && (state.active || state.busy || state.needsStopRetry)
    })
  }
  stopAll = () => Promise.all([...this.controllers.values()].map((controller) => controller.stop()))
}
