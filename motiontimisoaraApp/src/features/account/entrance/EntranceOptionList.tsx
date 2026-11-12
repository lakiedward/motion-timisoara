import { Badge } from '@/components/ui/badge'
import type { EntranceOption } from '@/api/attendance/entrance'
import { cn } from '@/lib/utils'
import { optionKey, remainingText, sessionTime, stateLabel } from './entrance-messages'

const RADIO =
  'accent-primary focus-visible:outline-ring size-4 shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2'

type Session = {
  occurrenceId: string
  courseName: string
  startsAt: string
  endsAt: string
  options: EntranceOption[]
}

function bySession(options: EntranceOption[]): Session[] {
  const sessions = new Map<string, Session>()
  for (const option of options) {
    const session = sessions.get(option.occurrenceId) ?? {
      occurrenceId: option.occurrenceId,
      courseName: option.courseName,
      startsAt: option.startsAt,
      endsAt: option.endsAt,
      options: [],
    }
    session.options.push(option)
    sessions.set(option.occurrenceId, session)
  }
  return [...sessions.values()]
}

export function EntranceOptionList({
  options,
  selected,
  disabled,
  onSelect,
}: {
  options: EntranceOption[]
  selected: string | null
  disabled: boolean
  onSelect: (key: string) => void
}) {
  return (
    <fieldset className="space-y-4" disabled={disabled}>
      <legend className="sr-only">Alege copilul și ședința</legend>
      {bySession(options).map((session) => (
        <section
          key={session.occurrenceId}
          aria-label={`${session.courseName}, ${sessionTime(session.startsAt, session.endsAt)}`}
          className="bg-card overflow-hidden rounded-xl border"
        >
          <div className="border-b px-4 py-3">
            <h2 className="font-display font-bold wrap-anywhere">{session.courseName}</h2>
            <p className="text-muted-foreground text-sm">
              Azi, {sessionTime(session.startsAt, session.endsAt)}
            </p>
          </div>
          <ul className="divide-y">
            {session.options.map((option) => {
              const key = optionKey(option)
              const available = option.state === 'AVAILABLE'
              const label = stateLabel(option.state)
              const remaining = available ? remainingText(option.remainingSessions) : null
              return (
                <li key={key}>
                  <label
                    className={cn(
                      'min-h-touch-target flex items-center gap-3 px-4 py-3',
                      available ? 'cursor-pointer' : 'cursor-not-allowed',
                      selected === key && 'bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="entrance-option"
                      className={RADIO}
                      value={key}
                      checked={selected === key}
                      disabled={!available}
                      onChange={() => onSelect(key)}
                    />
                    <span
                      aria-hidden="true"
                      className="bg-primary/10 text-primary grid size-10 shrink-0 place-items-center rounded-full font-bold"
                    >
                      {option.childName.charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold wrap-anywhere">{option.childName}</span>
                      {remaining && (
                        <span className="text-muted-foreground block text-sm">{remaining}</span>
                      )}
                    </span>
                    {label && (
                      <Badge variant={option.state === 'ALREADY_PRESENT' ? 'success' : 'secondary'}>
                        {label}
                      </Badge>
                    )}
                  </label>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </fieldset>
  )
}
