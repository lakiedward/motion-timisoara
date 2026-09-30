import { render, screen } from '@testing-library/react'
import { AuthFields } from './AuthFields'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

test.each([2, 4] as const)(
  'field rows preserve %i labeled inputs, errors and DOM order',
  (columns) => {
    const fields = ['Nume', 'Email', 'Telefon', 'Parolă'].slice(0, columns)
    const { container } = render(
      <form>
        <p>Răspuns server</p>
        <AuthFields columns={columns}>
          {fields.map((field, index) => (
            <div className="space-y-1.5" key={field}>
              <Label htmlFor={`field-${index}`}>{field}</Label>
              <Input id={`field-${index}`} aria-invalid />
              <p>Verifică {field}</p>
            </div>
          ))}
        </AuthFields>
        <button type="submit">Continuă</button>
      </form>,
    )
    const inputs = Array.from(container.querySelectorAll('input'))
    expect(inputs.map((input) => input.id)).toEqual(fields.map((_, index) => `field-${index}`))
    for (const field of fields) {
      expect(screen.getByLabelText(field)).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByText(`Verifică ${field}`)).toBeInTheDocument()
    }
    expect(screen.getByText('Răspuns server')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continuă' })).toHaveAttribute('type', 'submit')
  },
)
