import { useState, type InputHTMLAttributes } from 'react'
import { Icon } from './Icon'

// A secret input with a show/hide eye toggle, reused for passcodes and keys.
export function PasswordInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false)
  return (
    <div className={`pw ${className}`}>
      <input {...rest} type={shown ? 'text' : 'password'} className="pw-input" />
      <button type="button" className="pw-eye" onClick={() => setShown((s) => !s)}
        aria-label={shown ? 'Hide' : 'Show'} tabIndex={-1}>
        <Icon name={shown ? 'eyeOff' : 'eye'} size={16} />
      </button>
    </div>
  )
}
