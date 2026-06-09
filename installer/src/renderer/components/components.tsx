import type { ReactNode } from 'react';
import type { InstallStep, StepStatus } from '../../shared/types';

export function InstallerWindow({ children, step }: { children: ReactNode; step: number }) {
  return (
    <main className="installer-window">
      <aside className="step-rail" aria-label="Setup progress">
        <img src="./assets/brand-light.png" alt="Restaurant POS System" className="brand" />
        {['Welcome', 'Scope', 'Folder', 'Options', 'Review', 'Install'].map((label, index) => (
          <div className={`rail-step ${index <= step ? 'is-active' : ''}`} key={label}>
            <span>{index + 1}</span>
            <p>{label}</p>
          </div>
        ))}
        <footer>
          Version 1.5.8
          <br />
          CrysoLabs
        </footer>
      </aside>
      <section className="content-shell">{children}</section>
    </main>
  );
}

export function InstallerCard({ children }: { children: ReactNode }) {
  return <section className="installer-card screen-enter">{children}</section>;
}

export function PrimaryButton(props: JSX.IntrinsicElements['button']) {
  return <button {...props} className={`button primary ${props.className || ''}`} />;
}

export function SecondaryButton(props: JSX.IntrinsicElements['button']) {
  return <button {...props} className={`button secondary ${props.className || ''}`} />;
}

export function TextButton(props: JSX.IntrinsicElements['button']) {
  return <button {...props} className={`text-button ${props.className || ''}`} />;
}

export function OptionCard({
  title,
  description,
  selected,
  recommended,
  disabled,
  onClick
}: {
  title: string;
  description: string;
  selected?: boolean;
  recommended?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={`option-card ${selected ? 'is-selected' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="option-radio" aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        {recommended && <em>Recommended</em>}
        <small>{description}</small>
      </span>
    </button>
  );
}

export function CheckboxOption({
  title,
  description,
  checked,
  disabled,
  onChange
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`checkbox-option ${disabled ? 'is-disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </label>
  );
}

export function PathPicker({
  value,
  message,
  onChange
}: {
  value: string;
  message?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="path-picker">
      <label htmlFor="install-path">Destination folder</label>
      <div>
        <input id="install-path" value={value} onChange={(event) => onChange(event.target.value)} />
        <SecondaryButton type="button">Change location</SecondaryButton>
      </div>
      {message && <p role="status">{message}</p>}
    </div>
  );
}

export function ProgressRing() {
  return <span className="progress-ring" aria-label="Preparing setup" />;
}

export function ProgressBar({ value, indeterminate }: { value?: number; indeterminate?: boolean }) {
  return (
    <div
      className={`progress-bar ${indeterminate ? 'is-indeterminate' : ''}`}
      role="progressbar"
      aria-valuenow={value}
    >
      <span style={{ width: `${value || 12}%` }} />
    </div>
  );
}

export function StepProgressList({ steps }: { steps: InstallStep[] }) {
  return (
    <ol className="step-progress-list">
      {steps.map((step) => (
        <li className={`step-status ${step.status}`} key={step.id}>
          <StatusIcon status={step.status} />
          <span>
            <strong>{step.label}</strong>
            {step.detail && <small>{step.detail}</small>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function ErrorPanel({
  title,
  message,
  details,
  onOpenLog
}: {
  title: string;
  message: string;
  details?: string;
  onOpenLog: () => void;
}) {
  return (
    <div className="error-panel" role="alert">
      <h2>{title}</h2>
      <p>{message}</p>
      {details && (
        <details>
          <summary>Show details</summary>
          <pre>{details}</pre>
        </details>
      )}
      <div className="button-row">
        <SecondaryButton onClick={onOpenLog}>Open install log</SecondaryButton>
      </div>
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <TextButton onClick={onClose} aria-label="Close dialog">
            Close
          </TextButton>
        </header>
        {children}
      </section>
    </div>
  );
}

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === 'success') return <span className="status-icon success">✓</span>;
  if (status === 'failed') return <span className="status-icon failed">!</span>;
  if (status === 'active') return <span className="status-icon active" />;
  return <span className="status-icon pending" />;
}
