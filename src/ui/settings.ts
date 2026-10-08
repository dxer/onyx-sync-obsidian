import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import type CloudSyncPlugin from '../main';
import { SyncApiClient } from '../client';
import { t } from '../i18n';

const SAVE_DEBOUNCE_MS = 600;

/** Human-readable byte size (B / KB / MB / GB), one decimal place above bytes. */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (const u of units) {
    unit = u;
    if (value < 1024 || u === 'TB') break;
    value /= 1024;
  }
  return `${value >= 100 ? Math.round(value) : Math.round(value * 10) / 10} ${unit}`;
}

export class CloudSyncSettingTab extends PluginSettingTab {
  plugin: CloudSyncPlugin;
  private saveTimer: number | null = null;

  constructor(app: App, plugin: CloudSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Settings changes are debounced: typing a long token must not trigger a
   * save + engine re-init on every keystroke.
   */
  private scheduleSettingsSave(): void {
    if (this.saveTimer !== null) {
      window.clearTimeout(this.saveTimer);
    }
    this.saveTimer = window.setTimeout(() => {
      this.saveTimer = null;
      void this.plugin.saveSettings();
    }, SAVE_DEBOUNCE_MS);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName(t('settingsTitle')).setHeading();

    // 1. Connection Status Card — rendered immediately from cached info, then
    // refreshed asynchronously so a slow server never blanks the settings tab.
    const cached = this.plugin.settings;
    const statusDesc = new Setting(containerEl).setName(t('connectionStatusHeader'));
    const statusEl = statusDesc.descEl;
    if (cached.cachedVaultName && cached.cachedDeviceName) {
      statusEl.setText(
        t('statusConnected', {
          vaultName: cached.cachedVaultName,
          deviceName: cached.cachedDeviceName,
          version: '…'
        })
      );
    } else {
      statusEl.setText(t('statusDisconnected'));
    }
    if (cached.serverUrl && cached.deviceToken) {
      void this.refreshSessionStatus(statusEl);
    }

    // 1b. Vault Storage Usage — local plaintext sizes grouped by file format.
    // Rendered immediately with a placeholder, then filled asynchronously so a
    // large vault never blocks the settings tab.
    new Setting(containerEl).setName(t('storageHeader')).setHeading();
    const storageSetting = new Setting(containerEl).setDesc(t('storageLoading'));
    void this.refreshStorageStats(storageSetting.descEl);

    // 2. Server URL
    new Setting(containerEl)
      .setName(t('serverUrlName'))
      .setDesc(t('serverUrlDesc'))
      .addText((text) =>
        text
          .setPlaceholder('http://localhost:8080')
          .setValue(this.plugin.settings.serverUrl)
          .onChange((value) => {
            this.plugin.settings.serverUrl = value.trim();
            this.scheduleSettingsSave();
          })
      );

    // 3. Device Access Token (masked: stored encrypted, never shown in plain text)
    new Setting(containerEl)
      .setName(t('deviceTokenName'))
      .setDesc(t('deviceTokenDesc'))
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder(t('deviceTokenPlaceholder'))
          .setValue(this.plugin.settings.deviceToken)
          .onChange((value) => {
            this.plugin.settings.deviceToken = value.trim();
            this.scheduleSettingsSave();
          });
      });

    // 4. Passphrase (E2EE)
    new Setting(containerEl)
      .setName(t('passphraseName'))
      .setDesc(t('passphraseDesc'))
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder(t('passphrasePlaceholder'))
          .setValue(this.plugin.settings.passphrase)
          .onChange((value) => {
            this.plugin.settings.passphrase = value;
            this.plugin.passphraseEdited = true;
            this.scheduleSettingsSave();
          });
      });

    // 5. Confirm Passphrase — a freshly typed passphrase is only saved when
    // both entries match, guarding against typos that would lock you out.
    new Setting(containerEl)
      .setName(t('passphraseConfirmName'))
      .setDesc(t('passphraseConfirmDesc'))
      .addText((text) => {
        text.inputEl.type = 'password';
        text
          .setPlaceholder(t('passphrasePlaceholder'))
          .setValue(this.plugin.passphraseConfirm)
          .onChange((value) => {
            this.plugin.passphraseConfirm = value;
            this.scheduleSettingsSave();
          });
      });

    // 6. Auto Sync
    new Setting(containerEl)
      .setName(t('autoSyncName'))
      .setDesc(t('autoSyncDesc'))
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoSync)
          .onChange((value) => {
            this.plugin.settings.autoSync = value;
            this.scheduleSettingsSave();
          })
      );

    // 7. Sync Interval
    new Setting(containerEl)
      .setName(t('syncIntervalName'))
      .setDesc(t('syncIntervalDesc'))
      .addText((text) => {
        text.inputEl.type = 'number';
        text.setPlaceholder('30').setValue(String(this.plugin.settings.syncInterval));
        text.onChange((value) => {
          const seconds = Number(value);
          if (!Number.isFinite(seconds) || seconds < 0) return;
          this.plugin.settings.syncInterval = Math.floor(seconds);
          this.scheduleSettingsSave();
        });
      });

    // 8. File Sync Concurrency
    new Setting(containerEl)
      .setName(t('syncConcurrencyName'))
      .setDesc(t('syncConcurrencyDesc'))
      .addText((text) => {
        text.inputEl.type = 'number';
        text.setPlaceholder('3').setValue(String(this.plugin.settings.syncConcurrency));
        text.onChange((value) => {
          const concurrency = Number(value);
          if (!Number.isFinite(concurrency) || concurrency < 1) return;
          this.plugin.settings.syncConcurrency = Math.min(8, Math.floor(concurrency));
          this.scheduleSettingsSave();
        });
      });

    // 9. Rotate Passphrase — for a vault that is already syncing. Re-encrypts
    // every file with the new passphrase and re-uploads the whole vault;
    // other devices must enter the new passphrase afterwards. New devices
    // joining after a rotation just use the main passphrase field above.
    new Setting(containerEl).setName(t('rotateHeader')).setHeading();
    new Setting(containerEl).setDesc(t('rotateDesc'));

    let rotatePassphrase = '';
    let rotateConfirm = '';
    new Setting(containerEl)
      .setName(t('passphraseName'))
      .addText((text) => {
        text.inputEl.type = 'password';
        text.setPlaceholder(t('passphrasePlaceholder')).onChange((value) => {
          rotatePassphrase = value;
        });
      });
    new Setting(containerEl)
      .setName(t('passphraseConfirmName'))
      .addText((text) => {
        text.inputEl.type = 'password';
        text.setPlaceholder(t('passphrasePlaceholder')).onChange((value) => {
          rotateConfirm = value;
        });
      });
    new Setting(containerEl).addButton((button) =>
      button
        .setButtonText(t('rotateButton'))
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            await this.rotatePassphrase(rotatePassphrase, rotateConfirm);
            rotatePassphrase = '';
            rotateConfirm = '';
            this.display();
          } finally {
            button.setDisabled(false);
          }
        })
    );

    // Actions Header
    new Setting(containerEl).setName(t('actionsHeader')).setHeading();

    // Test Connection — builds the client from the CURRENT settings so edits
    // made in this tab are what gets tested.
    new Setting(containerEl)
      .setName(t('testConnectBtn'))
      .addButton((button) =>
        button.setButtonText(t('testConnectBtn')).onClick(async () => {
          const settings = this.plugin.settings;
          if (!settings.serverUrl || !settings.deviceToken) {
            new Notice(t('pleaseEnterRequiredFields'));
            return;
          }
          const client = new SyncApiClient(settings.serverUrl, settings.deviceToken);

          button.setDisabled(true);
          button.setButtonText(t('testingBtn'));

          try {
            const isHealthy = await client.checkHealth();
            if (!isHealthy) {
              new Notice(t('serverUnreachable'));
              return;
            }

            const session = await client.getSession();
            new Notice(
              t('connectedSuccessNotice', {
                vaultName: session.vaultName,
                deviceName: session.deviceName
              })
            );
            this.display();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            new Notice(`${t('serverUnreachable')} ${msg}`);
          } finally {
            button.setDisabled(false);
            button.setButtonText(t('testConnectBtn'));
          }
        })
      );

    // Sync Now
    new Setting(containerEl)
      .setName(t('syncNowBtn'))
      .addButton((button) =>
        button
          .setButtonText(t('syncNowBtn'))
          .setCta()
          .onClick(async () => {
            new Notice(t('syncingNotice'));
            await this.plugin.triggerSync({ force: true, fullScan: true });
          })
      );
  }

  private async rotatePassphrase(newPassphrase: string, confirm: string): Promise<void> {
    const engine = this.plugin.syncEngine;
    if (!engine) {
      new Notice(t('rotateNoEngineNotice'));
      return;
    }
    if (!newPassphrase || newPassphrase !== confirm) {
      new Notice(t('passphraseMismatchNotice'));
      return;
    }
    if (!engine.hasSyncedBefore()) {
      new Notice(t('rotateNeedInitNotice'));
      return;
    }
    if (await engine.hasPendingOutbox()) {
      new Notice(t('rotatePendingNotice'));
      return;
    }

    // Persist first so a retry (or restart) continues with the new keys;
    // the rotate fields are the second confirmation, so bypass the edit gate.
    this.plugin.settings.passphrase = newPassphrase;
    this.plugin.passphraseEdited = false;
    this.plugin.passphraseConfirm = '';
    await this.plugin.saveSettings();

    try {
      const count = await engine.rotatePassphrase();
      new Notice(t('rotateSuccessNotice', { count }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      new Notice(t('rotateFailedNotice', { error: message }));
    }
  }

  private async refreshStorageStats(storageEl: HTMLElement): Promise<void> {
    const engine = this.plugin.syncEngine;
    if (!engine) {
      storageEl.setText(t('storageUnavailable'));
      return;
    }
    try {
      const stats = await engine.getVaultStorageStats();
      if (stats.totalFiles === 0) {
        storageEl.setText(t('storageEmpty'));
        return;
      }
      storageEl.empty();
      const summary = document.createElement('div');
      summary.setText(t('storageSummary', { count: stats.totalFiles, size: formatBytes(stats.totalBytes) }));
      storageEl.appendChild(summary);
      for (const f of stats.formats) {
        const row = document.createElement('div');
        row.setText(
          t('storageRow', {
            ext: f.ext ? `.${f.ext}` : t('storageNoExt'),
            count: f.count,
            size: formatBytes(f.bytes)
          })
        );
        storageEl.appendChild(row);
      }
    } catch {
      storageEl.setText(t('storageUnavailable'));
    }
  }

  private async refreshSessionStatus(statusEl: HTMLElement): Promise<void> {
    try {
      const settings = this.plugin.settings;
      const client = new SyncApiClient(settings.serverUrl, settings.deviceToken);
      const session = await client.getSession();
      statusEl.setText(
        t('statusConnected', {
          vaultName: session.vaultName,
          deviceName: session.deviceName,
          version: session.latestVersion
        })
      );
      settings.cachedVaultId = session.vaultId;
      settings.cachedVaultName = session.vaultName;
      settings.cachedDeviceName = session.deviceName;
      await this.plugin.saveSettings();
    } catch {
      statusEl.setText(t('statusDisconnected'));
    }
  }
}
