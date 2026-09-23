import { describe, expect, it } from 'vitest'
import {
  competitionScheduleFromFields,
  competitionScheduleToFields,
  type CompetitionScheduleFields,
} from './competition-schedule'

const fields: CompetitionScheduleFields = {
  startDate: '2026-09-22',
  startTime: '09:00',
  endDate: '2026-09-22',
  endTime: '12:00',
  registrationDeadlineDate: '2026-09-21',
  registrationDeadlineTime: '18:00',
}

describe('competition schedule in Bucharest', () => {
  it('converts organizer wall time to UTC and back', () => {
    const schedule = competitionScheduleFromFields(fields)
    expect(schedule).toEqual({
      start_at: '2026-09-22T06:00:00.000Z',
      end_at: '2026-09-22T09:00:00.000Z',
      registration_deadline_at: '2026-09-21T15:00:00.000Z',
    })
    expect(competitionScheduleToFields(schedule)).toEqual(fields)
  })

  it('rejects a registration deadline after the competition begins', () => {
    expect(() =>
      competitionScheduleFromFields({
        ...fields,
        registrationDeadlineDate: fields.startDate,
        registrationDeadlineTime: '09:01',
      }),
    ).toThrow('Înscrierile trebuie să se închidă')
  })

  it('rejects invalid calendar dates and nonexistent daylight-saving times', () => {
    expect(() => competitionScheduleFromFields({ ...fields, startDate: '2026-02-30' })).toThrow(
      'Completează datele',
    )
    expect(() =>
      competitionScheduleFromFields({
        ...fields,
        startDate: '2026-03-29',
        startTime: '03:30',
      }),
    ).toThrow('Ora aleasă nu există')
  })
})
