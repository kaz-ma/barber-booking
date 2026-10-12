import { getLocale, getTranslations } from 'next-intl/server'
import { Footer } from '@/components/ui/footer'
import { SiteHeader } from '@/components/ui/header'
import { Icon } from '@/components/ui/icon'
import { InstagramLink } from '@/components/ui/instagram-link'
import { POLICY, shop } from '@/config/shop'
import { policyDateLabel } from '@/lib/i18n/policy-date'

type Section = {
  id: string
  title: string
  body: string[]
  items: string[]
  after: string[]
  aside: string
  rows: { k: string; v: string }[]
}

function fill(text: string, vars: Record<string, string | number>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}

/**
 * Policy document page (S-C-08 / S-C-09, 08_policy comp): caps label + H1, version and date,
 * table of contents (44px rows), H2 sections with a double rule, optional aside / table, back to
 * top. Text lives in messages (`privacy` / `policy` namespaces) so /en is fully English.
 */
export async function DocPage({
  namespace,
  vars,
  contactSection,
}: {
  namespace: 'privacy' | 'policy'
  vars: Record<string, string | number>
  /** Section id after which the Instagram DM button is shown. */
  contactSection?: string
}) {
  const [t, tDocs, locale] = await Promise.all([getTranslations(namespace), getTranslations('docs'), getLocale()])
  const sections = t.raw('sections') as Section[]
  const all = { handle: shop.instagram.handle, ...vars }
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap pt-6">
        <article aria-labelledby="doc-h">
          <header className="doc-head">
            <p className="caps" lang="en">
              {t('caps')}
            </p>
            <h1 id="doc-h" className="title-24" tabIndex={-1}>
              {t('title')}
            </h1>
            <p className="ver">{tDocs('version', { version: POLICY.version, date: policyDateLabel(locale) })}</p>
          </header>
          <p className="mt-4">{t('intro')}</p>
          <nav className="toc" aria-labelledby="toc-h">
            <h2 id="toc-h">{tDocs('toc')}</h2>
            <ol>
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>
                    <span className="n">{i + 1}</span>
                    <span>{s.title}</span>
                    <Icon name="chevronDown" />
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          {sections.map((s, i) => (
            <section key={s.id} className="pol" aria-labelledby={s.id}>
              <h2 id={s.id}>
                <span className="n">{i + 1}.</span>
                <span>{s.title}</span>
              </h2>
              {s.body.map((p) => (
                <p key={p}>{fill(p, all)}</p>
              ))}
              {s.items.length > 0 ? (
                <ul>
                  {s.items.map((it) => (
                    <li key={it}>{fill(it, all)}</li>
                  ))}
                </ul>
              ) : null}
              {s.after.map((p) => (
                <p key={p}>{fill(p, all)}</p>
              ))}
              {s.rows.length > 0 ? (
                <dl>
                  {s.rows.map((r) => (
                    <div key={r.k}>
                      <dt>{r.k}</dt>
                      <dd>{fill(r.v, all)}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {s.aside ? <p className="aside">{fill(s.aside, all)}</p> : null}
              {s.id === contactSection ? <InstagramLink variant="plain" className="mt-4" /> : null}
            </section>
          ))}
          <div className="totop">
            <a className="btn btn-ghost" href="#doc-h">
              {tDocs('toTop')}
              <Icon name="chevronRight" />
            </a>
          </div>
        </article>
      </main>
      <Footer />
    </>
  )
}
