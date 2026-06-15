import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StarRating } from '@/components/StarRating'

test('readonly StarRating exposes its value via aria-label', () => {
  render(<StarRating value={3.5} />)
  expect(screen.getByLabelText('3.5 din 5 stele')).toBeInTheDocument()
})

test('interactive StarRating calls onChange with the clicked star', async () => {
  const onChange = vi.fn()
  render(<StarRating value={0} onChange={onChange} />)
  await userEvent.click(screen.getByRole('radio', { name: '4 stele' }))
  expect(onChange).toHaveBeenCalledWith(4)
})
