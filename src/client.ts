import { requestUrl } from 'obsidian';
import type {
  CommitChangeItem,
  CommitResult
} from '@onyx/shared';
import {
  assertOkStatus,
  validateBlobCheck,
  validateChangesResponse,
  validateCommitResult,
  validateInitialSync,
  validateSessionInfo,
  validateSyncStatus,
  validateWsTicket
} from './validate';

export class SyncApiClient {
  private baseUrl: string;
  private token: string;

  constructor(serverUrl: string, token = '') {
    this.baseUrl = serverUrl.replace(/\/+$/, '');
    this.token = token.trim();
  }

  setCredentials(serverUrl: string, token: string): void {
    this.baseUrl = serverUrl.replace(/\/+$/, '');
    this.token = token.trim();
  }

  private getHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { ...extraHeaders };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  async checkHealth(): Promise<boolean> {
    try {
      const res = await requestUrl({
        url: `${this.baseUrl}/api/v1/health`,
        method: 'GET'
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  // Handshake session to get bound vault info, salt, and device name
  async getSession() {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/session`,
      method: 'GET',
      headers: this.getHeaders()
    });
    return validateSessionInfo(assertOkStatus(res, 'Session handshake'));
  }

  async getStatus() {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/status`,
      method: 'GET',
      headers: this.getHeaders()
    });
    return validateSyncStatus(assertOkStatus(res, 'Sync status'));
  }

  async getChanges(sinceVersion: number, limit = 200) {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/changes?since=${sinceVersion}&limit=${limit}`,
      method: 'GET',
      headers: this.getHeaders()
    });
    return validateChangesResponse(assertOkStatus(res, 'Fetch changes'));
  }

  async commit(changes: CommitChangeItem[], requestId?: string): Promise<CommitResult> {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/commit`,
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ requestId, changes })
    });
    return validateCommitResult(assertOkStatus(res, 'Commit'));
  }

  async checkBlobs(hashes: string[]) {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/blobs/check`,
      method: 'POST',
      headers: this.getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ hashes })
    });
    return validateBlobCheck(assertOkStatus(res, 'Check blobs'));
  }

  async uploadBlob(hash: string, data: Uint8Array): Promise<void> {
    const slice = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    const bodyBuffer = slice instanceof ArrayBuffer ? slice : new Uint8Array(data).slice().buffer;
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/blobs/${hash}`,
      method: 'PUT',
      headers: this.getHeaders({ 'Content-Type': 'application/octet-stream' }),
      body: bodyBuffer
    });
    assertOkStatus(res, 'Upload blob');
  }

  async downloadBlob(hash: string): Promise<Uint8Array> {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/blobs/${hash}`,
      method: 'GET',
      headers: this.getHeaders()
    });
    assertOkStatus(res, 'Download blob');
    return new Uint8Array(res.arrayBuffer);
  }

  // Exchanges the device token for a short-lived single-use WebSocket ticket.
  // Throws on deployments without WebSocket support (e.g. Cloudflare Worker).
  async createWsTicket(): Promise<{ ticket: string; expiresIn: number }> {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/ws/ticket`,
      method: 'POST',
      headers: this.getHeaders()
    });
    return validateWsTicket(assertOkStatus(res, 'WebSocket ticket request'));
  }

  async startInitialSync() {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/initialization/start`,
      method: 'POST',
      headers: this.getHeaders()
    });
    return validateInitialSync(assertOkStatus(res, 'Initial sync start'));
  }

  async heartbeatInitialSync(): Promise<void> {
    const res = await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/initialization/heartbeat`,
      method: 'POST',
      headers: this.getHeaders()
    });
    assertOkStatus(res, 'Initial sync heartbeat');
  }

  async completeInitialSync(): Promise<void> {
    await requestUrl({
      url: `${this.baseUrl}/api/v1/sync/initialization/complete`,
      method: 'POST',
      headers: this.getHeaders()
    });
  }
}
