import type { ReactNode } from 'react'
import './auth-fields.css'

interface AuthFieldsProps {
  columns: 2 | 4
  children: ReactNode
}

export function AuthFields({ columns, children }: AuthFieldsProps) {
  return (
    <div className="auth-fields space-y-4" data-landscape-columns={columns}>
      {children}
    </div>
  )
}
