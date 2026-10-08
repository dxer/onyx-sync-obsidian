import type {
  BlobCheckResponse,
  ChangesResponse,
  CommitResult,
  FileChange,
  InitialSyncResponse,
  SessionInfoResponse,
  SyncStatusResponse
} from '@onyx/shared';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function serverErrorText(json: unknown): string {
  if (!isRecord(json)) return '';
  const message = isString(json.error) ? json.error : '';
  const code = isString(json.code) ? `[${json.code}] ` : '';
  return message ? ` ${code}${message}` : '';
}

/**
 * Throws a descriptive Error when the HTTP status is not 2xx, preserving the
 * server-provided error and code so callers can branch on them (e.g.
 * blob-missing triggers one re-upload + retry in the outbox driver).
 */
export function assertOkStatus(
  res: { status: number; json: unknown },
  context: string
): unknown {
  if (res.status >= 200 && res.status < 300) return res.json;
  throw new Error(`${context} failed: HTTP ${res.status}${serverErrorText(res.json)}`);
}

export function validateSessionInfo(value: unknown): SessionInfoResponse {
  if (
    !isRecord(value) ||
    !isString(value.vaultId) ||
    !isString(value.vaultName) ||
    !isString(value.userId) ||
    !isString(value.username) ||
    !isString(value.deviceName) ||
    !isString(value.salt) ||
    !isSafeInteger(value.latestVersion) ||
    !isNumber(value.serverTime)
  ) {
    throw new Error('Invalid session response from server');
  }
  return value as unknown as SessionInfoResponse;
}

export function validateSyncStatus(value: unknown): SyncStatusResponse {
  if (
    !isRecord(value) ||
    !isString(value.vaultId) ||
    !isString(value.name) ||
    !isString(value.salt) ||
    !isSafeInteger(value.latestVersion) ||
    !isNumber(value.serverTime)
  ) {
    throw new Error('Invalid sync status response from server');
  }
  return value as unknown as SyncStatusResponse;
}

function validateFileChange(value: unknown): FileChange {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.encryptedPath) ||
    !isString(value.contentHash) ||
    !isSafeInteger(value.size) ||
    (value.size as number) < 0 ||
    !isSafeInteger(value.version) ||
    !isBoolean(value.isDeleted) ||
    !isNumber(value.mtime)
  ) {
    throw new Error('Invalid file change in server response');
  }
  if (!value.id || !value.encryptedPath) {
    throw new Error('Invalid file change in server response');
  }
  const contentHash = value.contentHash as string;
  if (contentHash !== '' && !/^[0-9a-fA-F]{64}$/.test(contentHash)) {
    throw new Error('Invalid file change in server response');
  }
  return value as unknown as FileChange;
}

export function validateChangesResponse(value: unknown): ChangesResponse {
  if (
    !isRecord(value) ||
    !isString(value.vaultId) ||
    !isSafeInteger(value.latestVersion) ||
    !Array.isArray(value.changes)
  ) {
    throw new Error('Invalid changes response from server');
  }
  const changes = (value.changes as unknown[]).map(validateFileChange);
  // Older servers predate pagination and omit hasMore. Preserve the absence
  // so callers can fall back to "a full page means maybe more".
  const hasMore = value.hasMore === undefined ? undefined : value.hasMore;
  if (hasMore !== undefined && !isBoolean(hasMore)) {
    throw new Error('Invalid changes pagination flag from server');
  }
  return { vaultId: value.vaultId, latestVersion: value.latestVersion, changes, hasMore };
}

export function validateCommitResult(value: unknown): CommitResult {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !isSafeInteger(value.newVersion) ||
    !isSafeInteger(value.committedCount)
  ) {
    throw new Error('Invalid commit response from server');
  }
  if (value.changes !== undefined) {
    if (!Array.isArray(value.changes)) throw new Error('Invalid commit response from server');
    for (const entry of value.changes as unknown[]) {
      if (!isRecord(entry) || !isString(entry.id) || !isString(entry.encryptedPath)) {
        throw new Error('Invalid commit response from server');
      }
    }
  }
  return value as unknown as CommitResult;
}

export function validateBlobCheck(value: unknown): BlobCheckResponse {
  if (
    !isRecord(value) ||
    !isStringArray(value.existingHashes) ||
    !isStringArray(value.missingHashes)
  ) {
    throw new Error('Invalid blob check response from server');
  }
  return value as unknown as BlobCheckResponse;
}

export function validateInitialSync(value: unknown): InitialSyncResponse {
  if (
    !isRecord(value) ||
    (value.status !== 'acquired' && value.status !== 'already_initialized') ||
    (value.leaseSeconds !== undefined && !isNumber(value.leaseSeconds))
  ) {
    throw new Error('Invalid initial sync response from server');
  }
  return value as unknown as InitialSyncResponse;
}

export function validateWsTicket(value: unknown): { ticket: string; expiresIn: number } {
  if (!isRecord(value) || !isString(value.ticket) || !isNumber(value.expiresIn)) {
    throw new Error('Invalid WebSocket ticket response from server');
  }
  return { ticket: value.ticket, expiresIn: value.expiresIn };
}
