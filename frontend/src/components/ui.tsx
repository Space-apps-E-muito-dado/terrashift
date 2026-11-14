import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical, Globe, LifeBuoy, MapPin, Orbit, Satellite, Sigma, UserRound } from 'lucide-react'
import type { SourceInfo } from '../lib/api'
import { STEP_COUNT } from '../lib/meta'
import { useI18n, type Lang } from '../lib/i18n'

export function Logo() {
  const { t } = useI18n()
  return (
    <Link to="/" className="logo" aria-label={t('common.home')}>
      <span className="logo-mark">
        <Orbit size={18} />
      </span>
      <span className="logo-word">TerraShift</span>
    </Link>
  )
}

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost'
export function Button({
  variant = 'primary',
  icon,
  iconLeft,
  children,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: ReactNode; iconLeft?: ReactNode }) {
  return (
    <button className={`btn btn-${variant} ${className}`} {...rest}>
      {iconLeft}
      <span>{children}</span>
      {icon}
    </button>
  )
}

const KIND_ICON: Record<SourceInfo['kind'], ReactNode> = {
  satellite: <Satellite size={12} />,
  regional: <Globe size={12} />,
  estimate: <Sigma size={12} />,
  user: <UserRound size={12} />,
}

export function SourceLabel({ kind, dataset, live = true }: { kind: SourceInfo['kind']; dataset?: string; live?: boolean }) {
  const { t } = useI18n()
  return (
    <span className={`source ${live ? '' : 'source-offline'}`} title={live ? undefined : t('common.offlineTitle')}>
      {KIND_ICON[kind]}
      <span>{t(`src.${kind}`)}</span>
      {dataset && (
        <>
          <i className="source-sep" />
          <span className="source-ds">{live ? dataset : t('common.offlineExample')}</span>
        </>
      )}
    </span>
  )
}

export function DemoBadge({ label }: { label: string }) {
  return (
    <span className="demo-badge">
      <FlaskConical size={12} />
      {label}
    </span>
  )
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />
}

export function LangSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="lang-switch" role="radiogroup" aria-label={t('common.language')}>
      {(['pt', 'en'] as Lang[]).map((l) => (
        <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? 'on' : ''} onClick={() => setLang(l)} lang={l === 'pt' ? 'pt-BR' : 'en'}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

export function AppHeader({
  farmName,
  page,
  step,
  action,
  demo = true,
}: {
  farmName?: string
  page?: string
  step?: number
  action?: ReactNode
  demo?: boolean
}) {
  const nav = useNavigate()
  const { t } = useI18n()
  return (
    <header className="app-header">
      <div className="ah-left">
        <Logo />
        <i className="ah-div" />
        <div className="ah-ctx">
          <MapPin size={16} />
          <strong>{farmName ?? t('common.newProperty')}</strong>
          {page && (
            <>
              <span className="ah-sep">/</span>
              <span className="muted">{page}</span>
            </>
          )}
        </div>
      </div>
      {step !== undefined && (
        <div className="stepper" aria-label={t('common.stepAria', { n: step + 1, total: STEP_COUNT })}>
          <div className="stepper-bars">
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <i key={i} className={i < step ? 'done' : i === step ? 'current' : ''} />
            ))}
          </div>
          <span>{t('common.stepOf', { n: step + 1, total: STEP_COUNT, name: t(`steps.${step}` as 'steps.0') })}</span>
        </div>
      )}
      <div className="ah-right">
        {demo && <DemoBadge label={t('common.demoFarm')} />}
        <LangSwitch />
        <button className="icon-btn" aria-label={t('common.help')} onClick={() => nav('/')}>
          <LifeBuoy size={18} />
        </button>
        {action}
      </div>
    </header>
  )
}

/** Marks anything derived from a crop the farmer described. */
export function EstTag({ dark = false }: { dark?: boolean }) {
  const { t } = useI18n()
  return (
    <span className={`est-tag ${dark ? 'dark' : ''}`} title={t('common.estimatedTitle')}>
      <Sigma size={10} />
      {t('common.estimated')}
    </span>
  )
}
