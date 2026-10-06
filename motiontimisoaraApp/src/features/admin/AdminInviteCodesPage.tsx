import CreateCoachForm from './invite-codes/CreateCoachForm'
import InviteCodesSection from './invite-codes/InviteCodesSection'

export default function AdminInviteCodesPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Coduri și antrenori</h1>
      <CreateCoachForm />
      <InviteCodesSection />
    </div>
  )
}
