import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical, Globe, LifeBuoy, MapPin, Orbit, Satellite, Sigma, UserRound } from 'lucide-react'
import type { SourceInfo } from '../lib/api'
import { STEPS } from '../lib/meta'

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="TerraShift — início">
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

const KIND: Record<SourceInfo['kind'], { label: string; icon: ReactNode }> = {
  satellite: { label: 'Observado por satélite', icon: <Satellite size={12} /> },
  regional: { label: 'Dado regional', icon: <Globe size={12} /> },
  estimate: { label: 'Estimativa', icon: <Sigma size={12} /> },
  user: { label: 'Informado por você', icon: <UserRound size={12} /> },
}

export function SourceLabel({ kind, dataset, live = true }: { kind: SourceInfo['kind']; dataset?: string; live?: boolean }) {
  const k = KIND[kind]
  return (
    <span className={`source ${live ? '' : 'source-offline'}`} title={live ? undefined : 'Fonte indisponível agora: exibindo valores de exemplo'}>
      {k.icon}
      <span>{k.label}</span>
      {dataset && (
        <>
          <i className="source-sep" />
          <span className="source-ds">{live ? dataset : 'exemplo offline'}</span>
        </>
      )}
    </span>
  )
}

export function DemoBadge({ label = 'Dados de demonstração' }: { label?: string }) {
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
  return (
    <header className="app-header">
      <div className="ah-left">
        <Logo />
        <i className="ah-div" />
        <div className="ah-ctx">
          <MapPin size={16} />
          <strong>{farmName ?? 'Nova propriedade'}</strong>
          {page && (
            <>
              <span className="ah-sep">/</span>
              <span className="muted">{page}</span>
            </>
          )}
        </div>
      </div>
      {step !== undefined && (
        <div className="stepper" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
          <div className="stepper-bars">
            {STEPS.map((_, i) => (
              <i key={i} className={i < step ? 'done' : i === step ? 'current' : ''} />
            ))}
          </div>
          <span>
            {step + 1} de {STEPS.length} — {STEPS[step]}
          </span>
        </div>
      )}
      <div className="ah-right">
        {demo && <DemoBadge label="Fazenda de exemplo" />}
        <button className="icon-btn" aria-label="Ajuda" onClick={() => nav('/')}>
          <LifeBuoy size={18} />
        </button>
        {action}
      </div>
    </header>
  )
}

export function ErrorState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="state-card">
      <strong>{title}</strong>
      <p className="muted">{text}</p>
      {action}
    </div>
  )
}
