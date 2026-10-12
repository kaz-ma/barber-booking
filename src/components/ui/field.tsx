import type { ReactNode } from 'react'
import { Icon } from './icon'

export type FieldAria = {
  id: string
  'aria-invalid'?: true
  'aria-describedby'?: string
}

/**
 * FieldWrapper (DES-07 `Field`): label, required/optional tag, help above the control and the
 * error right below it. Help and error are wired with aria-describedby (error first); the error
 * is prefixed with a visually hidden "エラー: " and never relies on colour (2px charcoal border
 * + "!" icon, 05_info_error comp).
 */
export function FieldWrapper({
  id,
  label,
  tag,
  help,
  error,
  errorPrefix,
  children,
  className = 'field',
}: {
  id: string
  label: ReactNode
  tag?: { text: string; optional?: boolean }
  help?: ReactNode
  error?: ReactNode
  errorPrefix: string
  children: (aria: FieldAria) => ReactNode
  className?: string
}) {
  const helpId = help ? `${id}-help` : undefined
  const errorId = error ? `${id}-err` : undefined
  const describedBy = [errorId, helpId].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={id}>
        {label}
        {tag ? <span className={tag.optional ? 'req opt' : 'req'}>{tag.text}</span> : null}
      </label>
      {help ? (
        <p className="help" id={helpId}>
          {help}
        </p>
      ) : null}
      {children({ id, ...(error ? { 'aria-invalid': true } : {}), 'aria-describedby': describedBy })}
      {error ? <FieldError id={errorId as string} prefix={errorPrefix} message={error} /> : null}
    </div>
  )
}

export function FieldError({ id, prefix, message }: { id: string; prefix: string; message: ReactNode }) {
  return (
    <p className="err" id={id}>
      <Icon name="alert" />
      <span>
        <span className="sr-only">{prefix}</span>
        {message}
      </span>
    </p>
  )
}
