'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { anonymizeCustomerAction, exportCustomerAction, updateCustomerRestrictionAction } from '../actions'
import { errorText, S } from '../strings'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/** S-A-11 (Should): booking restriction (dm_only), JSON export, anonymization (FR-A-13, 14). */
export function CustomerActions({
  customerId,
  restriction,
  hasPhone,
}: {
  customerId: string
  restriction: string
  hasPhone: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [value, setValue] = useState(restriction)
  const [last4, setLast4] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function changeRestriction(next: 'none' | 'dm_only' | 'blocked') {
    setValue(next)
    startTransition(async () => {
      const res = await updateCustomerRestrictionAction({ customerId, restriction: next })
      const failure = describeFailure(res)
      toast.show({ message: failure ?? S.customers.restrictionSaved })
      if (failure) setValue(restriction)
    })
  }

  function exportJson() {
    startTransition(async () => {
      const res = await exportCustomerAction({ customerId })
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        toast.show({ message: failure ?? (S.errors.generic as string) })
        return
      }
      const blob = new Blob([res.data.json], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = res.data.filename
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      toast.show({ message: S.customers.exported })
    })
  }

  function anonymize() {
    setError(null)
    if (!window.confirm(S.customers.anonymizeConfirm)) return
    startTransition(async () => {
      const res = await anonymizeCustomerAction({ customerId, confirmPhoneLast4: last4 })
      if (res.status === 'invalid') {
        setError(errorText(Object.values(res.fieldErrors)[0]?.[0]))
        return
      }
      const failure = describeFailure(res)
      if (failure || res.status !== 'ok') {
        setError(failure)
        return
      }
      toast.show({ message: S.customers.anonymized(res.data.cancelledBookings) })
      router.push('/admin/customers')
    })
  }

  return (
    <>
      <h2 className="sec-h">{S.customers.restrictionHead}</h2>
      <fieldset className="radio-list">
        <legend className="vh">{S.customers.restrictionHead}</legend>
        {(['none', 'dm_only', 'blocked'] as const).map((r) => (
          <label key={r}>
            <input
              type="radio"
              name="restriction"
              checked={value === r}
              disabled={pending}
              onChange={() => changeRestriction(r)}
            />
            {S.customers.restriction[r]}
          </label>
        ))}
      </fieldset>
      <p className="help mt-2">{S.customers.restrictionHelp}</p>

      <button className="btn btn-secondary btn-block mt-6" type="button" disabled={pending} onClick={exportJson}>
        <Icon name="copy" />
        {S.customers.export}
      </button>

      <section className="danger-zone" aria-labelledby="anon-h">
        <h2 id="anon-h">{S.customers.anonymizeHead}</h2>
        <p>{S.customers.anonymizeBody}</p>
        {hasPhone ? (
          <div className="field mt-4">
            <label className="label" htmlFor="last4">
              {S.customers.anonymizeLast4}
            </label>
            <input
              id="last4"
              className="input num"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={last4}
              aria-invalid={error ? true : undefined}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        ) : null}
        {error ? (
          <p className="field-error mt-2" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="btn btn-danger btn-block mt-4"
          type="button"
          disabled={pending || (hasPhone && last4.length !== 4)}
          onClick={anonymize}
        >
          {S.customers.anonymize}
        </button>
      </section>
    </>
  )
}
