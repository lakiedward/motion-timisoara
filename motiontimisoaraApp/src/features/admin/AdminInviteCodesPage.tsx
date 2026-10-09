import { deleteInviteCode, generateCoachInviteCode, getCoachInviteCodes } from '@/api/admin'
import InviteCodesSection, {
  type InviteCodesSource,
} from '@/components/invite-codes/InviteCodesSection'
import CreateCoachForm from './invite-codes/CreateCoachForm'

const adminCodes: InviteCodesSource = {
  queryKey: ['invite-codes'],
  load: getCoachInviteCodes,
  generate: generateCoachInviteCode,
  remove: deleteInviteCode,
}

export default function AdminInviteCodesPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground">Coduri și antrenori</h1>
      <CreateCoachForm />
      <InviteCodesSection
        source={adminCodes}
        title="Coduri invitație"
        description="Trimite codul unui antrenor ca să își creeze singur contul."
      />
    </div>
  )
}
