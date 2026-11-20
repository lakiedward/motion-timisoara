import { zodResolver } from '@hookform/resolvers/zod'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { expect, test, vi } from 'vitest'
import { z } from 'zod'

import {
  coursePackagesSchema,
  packagesToForm,
  packagesToPayload,
  type CoursePackage,
  type CoursePackagesFormValues,
} from '@/lib/course-packages/course-packages'
import { pickSelectMenuValue } from '@/test/select-menu'
import { CoursePackagesFields } from './CoursePackagesFields'

const schema = z.object({ packages: coursePackagesSchema })

function Harness({
  saved,
  onSave,
}: {
  saved: CoursePackage[]
  onSave: (values: CoursePackagesFormValues) => void
}) {
  const form = useForm<CoursePackagesFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { packages: packagesToForm(saved) },
  })
  return (
    <form onSubmit={form.handleSubmit(onSave)}>
      <CoursePackagesFields
        control={form.control}
        register={form.register}
        errors={form.formState.errors}
        currency="RON"
      />
      <button type="submit">Salvează</button>
    </form>
  )
}

test('pachetele pot expira după un număr de zile ales pentru tot cursul', async () => {
  const user = userEvent.setup()
  const onSave = vi.fn()
  render(
    <Harness
      saved={[
        { id: 'p1', position: 0, sessions: 8, price: 32000, validity: 'NONE', validity_days: null },
        { id: 'p2', position: 1, sessions: 12, price: 45000, validity: 'NONE', validity_days: null },
      ]}
      onSave={onSave}
    />,
  )
  await pickSelectMenuValue(screen.getByLabelText('Valabilitatea pachetelor'), 'DAYS')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Scrie un număr de zile între 7 și 365')).toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText('Număr de zile'), '45')
  expect(screen.getByText(/expiră după 45 de zile, numărate de la confirmarea plății/)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Adaugă un pachet' }))
  await user.type(screen.getByLabelText('Număr de ședințe', { selector: '#package-2-sessions' }), '4')
  await user.type(screen.getByLabelText('Preț total (lei)', { selector: '#package-2-price' }), '180')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  await waitFor(() => expect(onSave).toHaveBeenCalled())
  expect(packagesToPayload(onSave.mock.calls[0][0].packages)).toEqual([
    { id: 'p1', sessions: 8, price: 32000, validity: 'DAYS', validityDays: 45 },
    { id: 'p2', sessions: 12, price: 45000, validity: 'DAYS', validityDays: 45 },
    { sessions: 4, price: 18000, validity: 'DAYS', validityDays: 45 },
  ])
})

test('pachetele salvate cu zile se deschid cu numărul lor de zile', () => {
  render(
    <Harness
      saved={[{ id: 'p1', position: 0, sessions: 8, price: 32000, validity: 'DAYS', validity_days: 30 }]}
      onSave={vi.fn()}
    />,
  )
  expect(screen.getByLabelText('Număr de zile')).toHaveValue(30)
})
