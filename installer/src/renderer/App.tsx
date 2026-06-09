import { useEffect, useMemo, useState } from 'react';
import type { InstallOptions } from '../shared/types';
import {
  CheckboxOption,
  ErrorPanel,
  InstallerCard,
  InstallerWindow,
  Modal,
  OptionCard,
  PathPicker,
  PrimaryButton,
  ProgressBar,
  ProgressRing,
  SecondaryButton,
  StepProgressList,
  TextButton
} from './components/components';
import {
  defaultSteps,
  makeInitialState,
  updateStep,
  type InstallerState
} from './state/installer-state';
import './styles/tokens.css';
import './styles/installer.css';

const appName = 'Restaurant POS System';
const appPurpose = 'restaurant sales, kitchen display, inventory, and customer display workflows';

export default function App() {
  const [state, setState] = useState<InstallerState>(() => makeInitialState(''));
  const [licenseOpen, setLicenseOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [logText, setLogText] = useState('');
  const railIndex = useMemo(
    () =>
      ['welcome', 'scope', 'destination', 'options', 'review', 'installing', 'success'].indexOf(
        state.screen
      ),
    [state.screen]
  );

  useEffect(() => {
    let mounted = true;
    async function prepare() {
      const defaultPath = await window.installerApi.defaultPath('currentUser');
      const existing = await window.installerApi.detectExistingInstallation();
      const next = makeInitialState(defaultPath);
      if (existing.found) {
        next.mode = existing.isBroken
          ? 'reinstall'
          : existing.version === '1.5.8'
            ? 'repair'
            : 'update';
        next.existingVersion = existing.version;
        next.options.destination = existing.installPath || defaultPath;
        next.options.scope = existing.scope || 'currentUser';
        next.options.importPreviousSettings = true;
      }
      await window.installerApi.detectEnvironment();
      if (mounted) setState({ ...next, screen: existing.found ? 'existing' : 'welcome' });
    }
    prepare().catch((error) =>
      setState((current) => ({ ...current, screen: 'error', error: toError(error) }))
    );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return window.installerApi.onProgress((event) => {
      setState((current) => ({
        ...current,
        progress: event.progress ?? current.progress,
        steps: updateStep(current.steps, event.stepId, event.status, event.message)
      }));
    });
  }, []);

  async function setScope(scope: InstallOptions['scope']) {
    const destination = await window.installerApi.defaultPath(scope);
    setState((current) => ({ ...current, options: { ...current.options, scope, destination } }));
  }

  async function validateAndContinue() {
    const result = await window.installerApi.validateInstallPath(
      state.options.destination,
      state.options.scope
    );
    if (!result.ok) {
      setState((current) => ({
        ...current,
        screen: 'error',
        error: {
          title: 'Choose another folder',
          message: result.message || 'This folder cannot be used.',
          code: result.code || 'PATH_INVALID',
          actions: ['chooseFolder', 'cancel']
        }
      }));
      return;
    }
    setState((current) => ({ ...current, screen: 'options' }));
  }

  async function install() {
    setState((current) => ({ ...current, screen: 'installing', progress: 0, steps: defaultSteps }));
    const result =
      state.mode === 'repair'
        ? await window.installerApi.repairInstall(state.options)
        : await window.installerApi.startInstall(state.options);
    if (result.ok) {
      setState((current) => ({ ...current, screen: 'success', progress: 100 }));
    } else {
      setState((current) => ({ ...current, screen: 'error', error: result.error }));
    }
  }

  async function openLog() {
    setLogText(await window.installerApi.readInstallLog());
    setLogOpen(true);
  }

  return (
    <InstallerWindow step={Math.max(0, railIndex)}>
      {state.screen === 'preparing' && (
        <InstallerCard>
          <div className="centered">
            <ProgressRing />
            <h1>Preparing setup...</h1>
            <p>Checking this PC before we continue.</p>
          </div>
        </InstallerCard>
      )}

      {state.screen === 'existing' && (
        <InstallerCard>
          <p className="eyebrow">Existing installation found</p>
          <h1>
            {state.mode === 'update'
              ? `Update ${appName}`
              : state.mode === 'repair'
                ? `Repair ${appName}`
                : `Reinstall ${appName}`}
          </h1>
          <p>
            Your settings will be kept. Installed version: {state.existingVersion || 'Unknown'}.
          </p>
          <div className="option-grid">
            <OptionCard
              title="Update or repair"
              description="Refresh app files, shortcuts, and update metadata."
              selected
              recommended
              onClick={() => setState((current) => ({ ...current, screen: 'scope' }))}
            />
            <OptionCard
              title="Uninstall"
              description="Remove the app from this PC. You can choose whether to keep user data later."
              onClick={() => window.installerApi.uninstallApp(false)}
            />
          </div>
          <Footer
            primary="Continue"
            onPrimary={() => setState((current) => ({ ...current, screen: 'scope' }))}
          />
        </InstallerCard>
      )}

      {state.screen === 'welcome' && (
        <InstallerCard>
          <p className="eyebrow">CrysoLabs desktop setup</p>
          <h1>Install {appName}</h1>
          <p>A fast and secure desktop app for {appPurpose}.</p>
          <div className="hero-panel">
            <img src="./assets/hero.jpg" alt="" />
          </div>
          <div className="footer-meta">
            Version 1.5.8 · CrysoLabs ·{' '}
            <button onClick={() => setLicenseOpen(true)}>View license</button>
          </div>
          <Footer
            primary="Continue"
            onPrimary={() => setState((current) => ({ ...current, screen: 'scope' }))}
            secondary="Advanced options"
            onSecondary={() =>
              setState((current) => ({ ...current, advancedOpen: !current.advancedOpen }))
            }
          />
        </InstallerCard>
      )}

      {state.screen === 'scope' && (
        <InstallerCard>
          <h1>Choose who can use this app</h1>
          <p>
            Most people should install just for their Windows account. It does not need
            administrator permission.
          </p>
          <div className="option-grid">
            <OptionCard
              title="Install for me only"
              description="No administrator permission needed. Installs to Local AppData."
              selected={state.options.scope === 'currentUser'}
              recommended
              onClick={() => setScope('currentUser')}
            />
            <OptionCard
              title="Install for everyone"
              description="Choose this if multiple Windows accounts use this PC. Windows will ask for permission."
              selected={state.options.scope === 'allUsers'}
              onClick={() => setScope('allUsers')}
            />
          </div>
          <Footer
            onBack={() => setState((current) => ({ ...current, screen: 'welcome' }))}
            primary="Continue"
            onPrimary={() => setState((current) => ({ ...current, screen: 'destination' }))}
          />
        </InstallerCard>
      )}

      {state.screen === 'destination' && (
        <InstallerCard>
          <h1>Choose install location</h1>
          <p>Setup will validate the folder before installing.</p>
          <PathPicker
            value={state.options.destination}
            onChange={(destination) =>
              setState((current) => ({ ...current, options: { ...current.options, destination } }))
            }
          />
          <p className="helper">Required space: about 650 MB. Network folders are not supported.</p>
          <Footer
            onBack={() => setState((current) => ({ ...current, screen: 'scope' }))}
            primary="Continue"
            onPrimary={validateAndContinue}
          />
        </InstallerCard>
      )}

      {state.screen === 'options' && (
        <InstallerCard>
          <h1>Setup options</h1>
          <p>You can change these later from Windows settings or the app.</p>
          <div className="checks">
            <CheckboxOption
              title="Create desktop shortcut"
              description="Adds a shortcut on the desktop."
              checked={state.options.createDesktopShortcut}
              onChange={(v) => patchOptions({ createDesktopShortcut: v })}
            />
            <CheckboxOption
              title="Create Start Menu shortcut"
              description="Adds the app to the Start Menu."
              checked={state.options.createStartMenuShortcut}
              onChange={(v) => patchOptions({ createStartMenuShortcut: v })}
            />
            <CheckboxOption
              title={`Launch ${appName} after installation`}
              description="Starts the app when setup finishes."
              checked={state.options.launchAfterInstall}
              onChange={(v) => patchOptions({ launchAfterInstall: v })}
            />
            <CheckboxOption
              title={`Start ${appName} when Windows starts`}
              description="Opt-in only. Useful for dedicated POS terminals."
              checked={state.options.startWithWindows}
              onChange={(v) => patchOptions({ startWithWindows: v })}
            />
            <CheckboxOption
              title="Enable automatic updates"
              description="Keeps the desktop shell current."
              checked={state.options.enableAutoUpdates}
              onChange={(v) => patchOptions({ enableAutoUpdates: v })}
            />
            <CheckboxOption
              title="Send anonymous crash reports"
              description="Opt-in diagnostics only. No sales or customer data."
              checked={state.options.sendCrashReports}
              onChange={(v) => patchOptions({ sendCrashReports: v })}
            />
            {state.existingVersion && (
              <CheckboxOption
                title="Import settings from previous version"
                description="Your settings will be kept."
                checked={state.options.importPreviousSettings}
                onChange={(v) => patchOptions({ importPreviousSettings: v })}
              />
            )}
          </div>
          <Footer
            onBack={() => setState((current) => ({ ...current, screen: 'destination' }))}
            primary="Continue"
            onPrimary={() => setState((current) => ({ ...current, screen: 'review' }))}
          />
        </InstallerCard>
      )}

      {state.screen === 'review' && (
        <InstallerCard>
          <h1>Ready to install</h1>
          <dl className="review-list">
            <div>
              <dt>Install scope</dt>
              <dd>
                {state.options.scope === 'currentUser'
                  ? 'Install for me only'
                  : 'Install for everyone'}
              </dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{state.options.destination}</dd>
            </div>
            <div>
              <dt>Required space</dt>
              <dd>About 650 MB</dd>
            </div>
            <div>
              <dt>Version</dt>
              <dd>1.5.8{state.existingVersion ? ` · existing ${state.existingVersion}` : ''}</dd>
            </div>
          </dl>
          <Footer
            onBack={() => setState((current) => ({ ...current, screen: 'options' }))}
            primary="Install"
            onPrimary={install}
          />
        </InstallerCard>
      )}

      {state.screen === 'installing' && (
        <InstallerCard>
          <h1>Installing {appName}</h1>
          <p aria-live="polite">Finishing current step...</p>
          <ProgressBar value={state.progress} indeterminate={state.progress === 0} />
          <StepProgressList steps={state.steps} />
          <div className="button-row">
            <SecondaryButton disabled>Cancel</SecondaryButton>
          </div>
        </InstallerCard>
      )}

      {state.screen === 'success' && (
        <InstallerCard>
          <h1>{appName} is ready</h1>
          <p>
            {state.existingVersion
              ? `Updated from version ${state.existingVersion} to 1.5.8.`
              : 'Setup completed successfully.'}
          </p>
          <CheckboxOption
            title={`Launch ${appName} now`}
            description="Open the app after closing setup."
            checked={state.options.launchAfterInstall}
            onChange={(v) => patchOptions({ launchAfterInstall: v })}
          />
          <Footer
            primary="Finish"
            onPrimary={() => window.close()}
            secondary="Open install log"
            onSecondary={openLog}
          />
        </InstallerCard>
      )}

      {state.screen === 'error' && (
        <InstallerCard>
          <ErrorPanel
            title={state.error?.title || "We couldn't finish the installation"}
            message={state.error?.message || 'Setup stopped before making all changes.'}
            details={state.error?.details}
            onOpenLog={openLog}
          />
          <Footer
            primary="Retry"
            onPrimary={() => setState((current) => ({ ...current, screen: 'review' }))}
            secondary="Cancel setup"
            onSecondary={() => window.close()}
          />
        </InstallerCard>
      )}

      {licenseOpen && (
        <Modal title="License" onClose={() => setLicenseOpen(false)}>
          <p>Copyright CrysoLabs. Replace this placeholder with your production EULA.</p>
        </Modal>
      )}
      {logOpen && (
        <Modal title="Install log" onClose={() => setLogOpen(false)}>
          <pre className="log-viewer">{logText || 'No log entries yet.'}</pre>
        </Modal>
      )}
    </InstallerWindow>
  );

  function patchOptions(patch: Partial<InstallOptions>) {
    setState((current) => ({ ...current, options: { ...current.options, ...patch } }));
  }
}

function Footer({
  primary,
  secondary,
  onPrimary,
  onSecondary,
  onBack
}: {
  primary: string;
  secondary?: string;
  onPrimary: () => void;
  onSecondary?: () => void;
  onBack?: () => void;
}) {
  return (
    <div className="footer-actions">
      {onBack && <SecondaryButton onClick={onBack}>Back</SecondaryButton>}
      <div />
      {secondary && <TextButton onClick={onSecondary}>{secondary}</TextButton>}
      <PrimaryButton onClick={onPrimary}>{primary}</PrimaryButton>
    </div>
  );
}

function toError(error: unknown) {
  return {
    title: "We couldn't prepare setup",
    message: error instanceof Error ? error.message : String(error),
    code: 'UNKNOWN' as const,
    details: error instanceof Error ? error.stack : undefined,
    actions: ['retry', 'openLog', 'cancel'] as const
  };
}
