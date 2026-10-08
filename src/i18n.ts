import { getLanguage } from 'obsidian';

export type Locale = 'en' | 'zh';

const en = {
  // General & Status
  pluginName: 'Onyx Sync (E2EE)',
  syncReady: 'Sync: Ready',
  syncInProgress: 'Sync: In progress...',
  syncError: 'Sync: Error',
  syncOffline: 'Sync: Disconnected',
  syncNowCommand: 'Sync Now',
  syncNowRibbon: 'Sync Now',
  syncingNotice: 'Synchronizing vault...',
  syncSuccessNotice: 'Sync completed successfully.',
  syncFailedNotice: 'Sync failed: {error}',
  syncProgress: 'Sync: {done}/{total}',
  authFailedNotice: 'Device token was rejected (HTTP 401). Please check the Server URL and Device Token.',
  passphraseHintNotice: 'Sync failed: {error}. If decryption keeps failing, verify the passphrase matches your other devices.',

  // Connection & Settings
  settingsTitle: 'Onyx Sync (E2EE)',
  connectionStatusHeader: 'Connection Status',
  statusConnected: 'Connected: {vaultName} ({deviceName}, v{version})',
  statusDisconnected: 'Disconnected (Please configure Server URL and Device Token)',
  storageHeader: 'Vault Storage Usage',
  storageLoading: 'Calculating local vault usage…',
  storageSummary: '{count} files, {size} total',
  storageRow: '{ext}: {count} files, {size}',
  storageNoExt: 'no extension',
  storageEmpty: 'No files in this vault yet.',
  storageUnavailable: 'Storage stats are unavailable until the sync engine starts.',
  serverUrlName: 'Server URL',
  serverUrlDesc: 'Sync server endpoint address (e.g. http://localhost:8080 or https://sync.example.com)',
  deviceTokenName: 'Device Access Token',
  deviceTokenDesc: 'Dedicated token generated on the management console for this device and vault. Stored encrypted and never shown in plain text.',
  deviceTokenPlaceholder: 'ost_xxxxxx',
  passphraseName: 'Encryption Passphrase',
  passphraseDesc: 'Zero-knowledge end-to-end encryption master key. Never sent to server; must match across all paired devices.',
  passphrasePlaceholder: 'Enter master encryption passphrase',
  passphraseConfirmName: 'Confirm Passphrase',
  passphraseConfirmDesc: 'Re-enter the passphrase. A newly typed passphrase is only saved when both entries match.',
  passphraseMismatchNotice: 'The two passphrases do not match. Nothing was saved.',
  rotateHeader: 'Rotate Passphrase',
  rotateDesc: 'For a vault that is already syncing: re-encrypts every file with a new passphrase and re-uploads the whole vault. Afterwards, enter the new passphrase on your other devices.',
  rotateButton: 'Rotate & Re-upload Vault',
  rotateNoEngineNotice: 'Sync engine is not ready yet.',
  rotateNeedInitNotice: 'This vault has not been synced yet — set the passphrase in the main field above instead.',
  rotatePendingNotice: 'Please run a normal sync first so no unsent changes are left behind.',
  rotateSuccessNotice: 'Rotation complete: re-uploaded {count} files. Enter the new passphrase on your other devices.',
  rotateFailedNotice: 'Rotation failed: {error}',
  autoSyncName: 'Automatic Synchronization',
  autoSyncDesc: 'Synchronize on file modification, window focus, and background interval',
  syncIntervalName: 'Background Sync Interval (seconds)',
  syncIntervalDesc: 'How often to poll the server when no changes are detected (0 disables interval sync)',
  syncConcurrencyName: 'File Sync Concurrency',
  syncConcurrencyDesc: 'Number of complete files processed at once. Files are not split into chunks (1–8).',

  // Actions
  actionsHeader: 'Connection & Operations',
  testConnectBtn: 'Test Connection',
  testingBtn: 'Connecting...',
  syncNowBtn: 'Sync Now',
  serverUnreachable: 'Server unreachable or returned invalid response.',
  connectedSuccessNotice: 'Connected to vault [{vaultName}] as [{deviceName}].',
  pleaseEnterRequiredFields: 'Please configure Server URL, Device Token, and Passphrase.'
};

const zh: typeof en = {
  // General & Status
  pluginName: 'Onyx 同步 (E2EE)',
  syncReady: '同步状态：就绪',
  syncInProgress: '同步状态：同步中...',
  syncError: '同步状态：连接异常',
  syncOffline: '同步状态：未连接',
  syncNowCommand: '立即执行同步',
  syncNowRibbon: 'Onyx 同步：立即执行同步',
  syncingNotice: '正在同步知识库...',
  syncSuccessNotice: '同步已完成。',
  syncFailedNotice: '同步失败: {error}',
  syncProgress: '同步中 {done}/{total}',
  authFailedNotice: '设备令牌被拒绝（HTTP 401），请检查服务端地址与设备令牌。',
  passphraseHintNotice: '同步失败: {error}。若解密持续失败，请确认主密码与其他设备一致。',

  // Connection & Settings
  settingsTitle: 'Onyx 同步设置 (端到端加密)',
  connectionStatusHeader: '连接状态',
  statusConnected: '已连接: {vaultName} (设备: {deviceName}, 协议时钟: v{version})',
  statusDisconnected: '未连接 (请在下方配置服务端地址与设备访问令牌)',
  storageHeader: '知识库存储占用',
  storageLoading: '正在统计本地知识库…',
  storageSummary: '{count} 个文件，共 {size}',
  storageRow: '{ext}：{count} 个文件，{size}',
  storageNoExt: '无扩展名',
  storageEmpty: '该知识库暂无文件。',
  storageUnavailable: '同步引擎启动后才能统计存储占用。',
  serverUrlName: '服务端地址 (Server URL)',
  serverUrlDesc: '同步服务器地址 (如 http://localhost:8080 或 https://sync.example.com)',
  deviceTokenName: '设备访问令牌 (Device Token)',
  deviceTokenDesc: '在管理控制台中为当前设备和知识库生成的专用访问令牌。加密存储，不以明文显示。',
  deviceTokenPlaceholder: 'ost_xxxxxx',
  passphraseName: '端到端加密主密码 (Passphrase)',
  passphraseDesc: '零知识加密的核心密钥，仅在本地内存派生，不上传服务端；所有多端设备需保持一致。',
  passphrasePlaceholder: '请输入加密主密码',
  passphraseConfirmName: '确认主密码',
  passphraseConfirmDesc: '再次输入主密码，仅当两次输入一致时才会保存新密码。',
  passphraseMismatchNotice: '两次输入的主密码不一致，未保存任何设置。',
  rotateHeader: '更换主密码',
  rotateDesc: '用于已在同步的知识库：用新主密码重新加密全部文件并重新上传。完成后，请在其他设备填入新主密码。',
  rotateButton: '更换并重新上传',
  rotateNoEngineNotice: '同步引擎尚未就绪。',
  rotateNeedInitNotice: '该知识库尚未同步过，请直接在上方主密码栏设置。',
  rotatePendingNotice: '请先正常同步一次，不要留下未发送的更改。',
  rotateSuccessNotice: '更换完成：已重新上传 {count} 个文件。请在其他设备填入新主密码。',
  rotateFailedNotice: '更换失败：{error}',
  autoSyncName: '后台自动同步',
  autoSyncDesc: '笔记保存、窗口聚焦及定时在后台自动执行静默增量同步',
  syncIntervalName: '后台同步间隔 (秒)',
  syncIntervalDesc: '无变更时轮询服务端的间隔（设为 0 关闭定时轮询，仅保留事件触发同步）',
  syncConcurrencyName: '文件同步并行数',
  syncConcurrencyDesc: '同时处理的完整文件数量，不会拆分文件（1–8）。',

  // Actions
  actionsHeader: '连接与操作',
  testConnectBtn: '测试连接',
  testingBtn: '正在连接...',
  syncNowBtn: '立即同步',
  serverUnreachable: '无法连接到服务端或服务端返回异常。',
  connectedSuccessNotice: '已成功建立连接：知识库 [{vaultName}] (授权设备: {deviceName})。',
  pleaseEnterRequiredFields: '请完整配置服务端地址、设备令牌与加密主密码。'
};

const translations = { en, zh };

export function getCurrentLocale(): Locale {
  const lang = (typeof getLanguage === 'function' ? getLanguage() : (document.documentElement.lang || navigator.language || '')).toLowerCase();
  if (lang.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}

export function t(key: keyof typeof en, params: Record<string, string | number> = {}): string {
  const locale = getCurrentLocale();
  const dict = translations[locale] || translations.en;
  let text = dict[key] || translations.en[key] || key;

  for (const paramKey of Object.keys(params)) {
    const paramVal = params[paramKey];
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
  }

  return text;
}
