'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { deleteRecurringBlockAction } from '../actions'
import type { RecurringBlock } from '../recurring'
import { S } from '../strings'
import { Icon } from './icon'
import { hhmm } from './time-utils'
import { useToast } from './toast'
import { describeFailure } from './use-admin-action'

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'] as const
const ORDER = [1, 2, 3, 4, 5, 6, 0]

/** B7: the weekly breaks, each with やめる (removes it from now on). */
export function RecurringList({ rules }: { rules: RecurringBlock[] }) {
  const toast = useToast()
  const [pending, startTransition] = useTransition()

  function stop(rule: RecurringBlock) {
    if (!window.confirm(S.blockForm.ruleDeleteConfirm)) return
    startTransition(async () => {
      const res = await deleteRecurringBlockAction({ ruleId: rule.id })
      const failure = describeFailure(res)
      toast.show({ message: failure ?? (res.status === 'ok' ? S.blockForm.ruleDeleted(res.data.removed) : '') })
    })
  }

  return (
    <section aria-labelledby="rr-h">
      <h2 id="rr-h" className="v2-sec-h">
        {S.blockForm.rules}
      </h2>
      {rules.length === 0 ? (
        <p className="v2-cap">{S.blockForm.rulesNone}</p>
      ) : (
        <ul className="v2-list">
          {rules.map((r) => (
            <li key={r.id} className="v2-card rr-row">
              <span>
                <b className="num">
                  {hhmm(r.startMin)}–{hhmm(r.endMin)}
                </b>{' '}
                {S.blockKind[r.kind] ?? r.kind}
                {r.label ? `（${r.label}）` : ''}
                <span className="v2-cap rr-days">
                  {S.blockForm.everyWeek(
                    ORDER.filter((d) => r.weekdays.includes(d))
                      .map((d) => WEEKDAY_JA[d])
                      .join('・'),
                  )}
                </span>
              </span>
              <button className="btn btn-ghost btn-sm" type="button" disabled={pending} onClick={() => stop(r)}>
                {S.blockForm.ruleDelete}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Link className="btn btn-secondary btn-block rr-add" href="/admin/blocks/new">
        <Icon name="block" />
        {S.day.addBlock}
      </Link>
    </section>
  )
}
