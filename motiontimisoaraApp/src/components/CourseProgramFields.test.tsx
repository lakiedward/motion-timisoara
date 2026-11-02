import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import CourseProgramFields from './CourseProgramFields'
import {
  courseProgramSchema,
  emptyCourseProgram,
  validateCourseProgramFields,
} from '@/lib/course-program/recurrence'
import { setPickerValue, pickerValue } from '@/test/pickers'

const schema = z.object({ program: courseProgramSchema }).superRefine(validateCourseProgramFields)

function Harness() {
  const { control, setValue, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { program: emptyCourseProgram() },
  })
  return (
    <form onSubmit={handleSubmit(() => undefined)} noValidate>
      <CourseProgramFields
        control={control}
        setValue={setValue}
        errors={formState.errors}
      />
      <button type="submit">Salvează</button>
    </form>
  )
}

test('save without a day explains that the program is required', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Selectează cel puțin o zi și completează orele.'),
  ).toBeInTheDocument()
})

test('selecting a day does not invent hours', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Luni' }))
  const grup = screen.getByRole('group', { name: 'Luni' })
  expect(pickerValue(within(grup).getByLabelText('Ora start'))).toBe('')
  expect(pickerValue(within(grup).getByLabelText('Ora final'))).toBe('')
  expect(screen.getByRole('button', { name: 'Luni' })).toHaveAttribute('aria-pressed', 'true')
})

test('a selected day without hours is named in the error', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Marți' }))
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(await screen.findByText('Completează orele pentru Marți.')).toBeInTheDocument()
})

test('completed hours show the preview and end-before-start is rejected', async () => {
  const user = userEvent.setup()
  render(<Harness />)
  await user.click(screen.getByRole('button', { name: 'Luni' }))
  const grup = screen.getByRole('group', { name: 'Luni' })
  setPickerValue(within(grup).getByLabelText('Ora start'), '19:00')
  setPickerValue(within(grup).getByLabelText('Ora final'), '18:00')
  await user.click(screen.getByRole('button', { name: 'Salvează' }))
  expect(
    await screen.findByText('Ora de final trebuie să fie după ora de început pentru Luni.'),
  ).toBeInTheDocument()

  setPickerValue(within(grup).getByLabelText('Ora final'), '20:00')
  expect(screen.getByText('Luni 19:00–20:00')).toBeInTheDocument()
})
