'use client'

import { useState, useTransition } from 'react'
import { setInstagramHandleAction } from '../actions'
import { errorText, S } from '../strings'
import { Icon } from './icon'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

/** B6: the customer's Instagram username, so the DM thread opens with one tap (ig.me). */
export function InstagramField({ customerId, handle }: { customerId: string; handle: string | null }) {
  const toast = useToast()
  const [value, setValue] = useState(handle ?? '')
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await setInstagramHandleAction({ customerId, handle: value })
      if (res.status === 'invalid') {
        setError(errorText(Object.values(res.fieldErrors)[0]?.[0]))
        return
      }
      toast.show({ message: describeFailure(res) ?? S.revisit.igSaved, placement: 'bottom', icon: res.status === 'ok' })
    })
  }

  return (
    <div className="field ig-field">
      <label className="label" htmlFor="ig">
        {S.revisit.igLabel}
      </label>
      <div className="search-row">
        <span className="prefix">
          <span aria-hidden="true">@</span>
          <input
            id="ig"
            className="input"
            type="text"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="neuer.kento"
            value={value}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setValue(e.target.value)}
          />
        </span>
        <button className="btn btn-secondary" type="button" disabled={pending} onClick={save}>
          {S.save}
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : <p className="v2-cap">{S.revisit.igHelp}</p>}
      {handle ? (
        <a
          className="btn btn-secondary btn-block"
          href={`https://ig.me/m/${encodeURIComponent(handle)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Icon name="send" />
          {S.revisit.openIgFull}
        </a>
      ) : null}
    </div>
  )
}
