import { supabase } from '@/lib/supabase'

export type AttendanceRequest = {
  requestId: string
  occurrenceId: string
  status: 'PRESENT' | 'ABSENT' | null
} & ({ childId: string } | { qrToken: string } | { childIds: string[]; onlyUnmarked: true })

export type AttendanceResult = {
  success: true
  outcome: 'recorded' | 'duplicate'
  childName?: string
}

export class AttendanceError extends Error {
  readonly retryable: boolean
  readonly code: string
  constructor(message: string, retryable: boolean, code = 'NETWORK') {
    super(message)
    this.retryable = retryable
    this.code = code
  }
}

const messages: Record<string, string> = {
  MANUAL_OVERRIDE: 'Prezența a fost modificată manual. Verifică în catalog.',
  NO_REMAINING_SESSIONS: 'Copilul nu mai are ședințe disponibile. Verifică abonamentul.',
  NOT_ENROLLED: 'Copilul nu are o înscriere activă la acest curs.',
  INVALID_QR: 'Codul nu mai este valabil. Cere codul actual al copilului.',
  FORBIDDEN: 'Nu ai acces la această ședință.',
  AMBIGUOUS_ENROLLMENT: 'Există mai multe înscrieri active. Contactează administratorul.',
}

export async function recordAttendance(
  body: AttendanceRequest,
  actorId?: string,
): Promise<AttendanceResult> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError || !session || (actorId && session.user.id !== actorId)) {
    throw new AttendanceError(
      'Autentifică-te din nou în contul antrenorului pentru sincronizare.',
      true,
      'AUTH',
    )
  }
  const { data, error } = await supabase.functions.invoke('record-attendance', {
    body,
    signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (error) {
    const response = error.context instanceof Response ? error.context : null
    const detail = response ? await response.json().catch(() => null) : null
    const code = detail?.code ?? (response?.status === 401 ? 'AUTH' : 'NETWORK')
    const retryable =
      !response || [401, 408, 429].includes(response.status) || response.status >= 500
    throw new AttendanceError(
      messages[code] ?? detail?.message ?? 'Nu am putut confirma prezența. Reîncearcă.',
      retryable,
      code,
    )
  }
  if (data?.success !== true || !['recorded', 'duplicate'].includes(data?.outcome)) {
    const code = data?.code ?? 'INVALID_RESPONSE'
    throw new AttendanceError(
      messages[code] ?? data?.message ?? 'Răspunsul serverului nu a putut fi confirmat.',
      !data?.code,
      code,
    )
  }
  return data as AttendanceResult
}

export async function markAttendance(
  occurrenceId: string,
  childId: string,
  status: AttendanceRequest['status'],
) {
  await recordAttendance({ requestId: crypto.randomUUID(), occurrenceId, childId, status })
}

export async function markManyPresent(occurrenceId: string, childIds: string[]) {
  if (!childIds.length) return
  await recordAttendance({
    requestId: crypto.randomUUID(),
    occurrenceId,
    childIds,
    onlyUnmarked: true,
    status: 'PRESENT',
  })
}
