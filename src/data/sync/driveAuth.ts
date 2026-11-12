/**
 * GOOGLE DRIVE OAUTH + API CLIENT
 * ============================================================================
 *
 * Handles Google OAuth 2.0 authorization (narrow drive.file scope) and makes
 * authenticated calls to the Google Drive REST API v3.
 *
 * OAuth flow (client-side, no backend):
 *   1. Open a popup to Google's authorization endpoint
 *   2. User signs in and grants drive.file access
 *   3. Google redirects the popup to our redirect URI with the access token
 *      in the URL fragment (implicit flow)
 *   4. We poll the popup location until it lands on the redirect URI, extract
 *      the token, close the popup, and store it
 *
 * Tokens are kept in memory (access token) and localStorage (refresh token for
 * offline restoration). The narrow scope means this app can only see files it
 * created itself — nothing else in the user's Drive is reachable.
 */

import type { BackupManifest } from "./adapter";

/* -------------------------------------------------------------------------- */
/*  Configuration                                                             */
/* -------------------------------------------------------------------------- */

/** Set this in `.env` as `VITE_GOOGLE_DRIVE_CLIENT_ID`. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID;

/** Narrow scope: only files this app created. */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

/** Redirect URI must be registered in Google Cloud Console. */
export const REDIRECT_URI =
  import.meta.env.VITE_GOOGLE_DRIVE_REDIRECT_URI ??
  `${window.location.protocol}//${window.location.host}/oauth-callback`;

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3";

/** Folder that holds backups, visible to the user in Drive. */
export const BACKUP_FOLDER_NAME = "Personal Finance Backups";

/* -------------------------------------------------------------------------- */
/*  Token storage                                                             */
/* -------------------------------------------------------------------------- */

const ACCESS_TOKEN_KEY = "pocket-ledger-drive-access-token";
const REFRESH_TOKEN_KEY = "pocket-ledger-drive-refresh-token";
const EXPIRES_AT_KEY = "pocket-ledger-drive-expires-at";

let accessToken: string | null = null;
let expiresAt = 0;

function getStored<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function setStored(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage may be unavailable in private modes */
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function loadStoredTokens(): void {
  accessToken = getStored<string>(ACCESS_TOKEN_KEY);
  expiresAt = getStored<number>(EXPIRES_AT_KEY) ?? 0;
}

function persistTokens(tok: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}): void {
  accessToken = tok.access_token;
  expiresAt = Date.now() + tok.expires_in * 1000 - 60_000;
  setStored(ACCESS_TOKEN_KEY, accessToken);
  setStored(EXPIRES_AT_KEY, expiresAt);
  if (tok.refresh_token) {
    setStored(REFRESH_TOKEN_KEY, tok.refresh_token);
  }
}

function clearStoredTokens(): void {
  accessToken = null;
  expiresAt = 0;
  removeStored(ACCESS_TOKEN_KEY);
  removeStored(REFRESH_TOKEN_KEY);
  removeStored(EXPIRES_AT_KEY);
}

/* -------------------------------------------------------------------------- */
/*  OAuth                                                                     */
/* -------------------------------------------------------------------------- */

declare global {
  interface Window {
    google: any;
  }
}

export function isConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_ID.trim().length > 0);
}

export function isAuthenticated(): boolean {
  return accessToken !== null && Date.now() < expiresAt;
}

/** The Google Identity Services token client, initialized once GIS loads. */
let tokenClient: any = null;

/** Settlers for the in-flight token request (popup flow). */
let tokenRequestResolve: ((token: string) => void) | null = null;
let tokenRequestReject: ((error: Error) => void) | null = null;

/** Initialize the GIS token client (called after the GIS script loads). */
function initTokenClient(): void {
  if (tokenClient || !window.google?.accounts?.oauth2) return;
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID!,
    scope: DRIVE_SCOPE,
    callback: (response: any) => {
      const resolve = tokenRequestResolve;
      const reject = tokenRequestReject;
      tokenRequestResolve = null;
      tokenRequestReject = null;

      if (response.error) {
        reject?.(new Error(`Google authorization failed: ${response.error}`));
      } else if (response.access_token) {
        resolve?.(response.access_token);
      } else {
        reject?.(new Error("No access token returned from Google."));
      }
    },
  });
}

/** Wait for the GIS library to load, then initialize the token client. */
function ensureTokenClient(): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (window.google?.accounts?.oauth2) {
        initTokenClient();
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/**
 * Connect to Google Drive using the token client (popup flow).
 *
 * Opens a Google consent popup. After the user grants access, Google calls
 * back with an access token directly — no redirect, no code exchange, no CORS.
 * The page never navigates away, so the UI stays intact.
 */
export async function connectDrive(): Promise<{ accountLabel: string; accessToken: string }> {
  if (!isConfigured()) {
    throw new Error(
      "Google Drive is not configured. Set VITE_GOOGLE_DRIVE_CLIENT_ID (and optionally VITE_GOOGLE_DRIVE_REDIRECT_URI) in .env.",
    );
  }

  await ensureTokenClient();
  const client = tokenClient;
  if (!client) {
    throw new Error("Google Identity Services client could not be initialized.");
  }

  const token = await new Promise<string>((resolve, reject) => {
    tokenRequestResolve = resolve;
    tokenRequestReject = reject;

    client.requestAccessToken({
      prompt: "consent",
    });
  });

  persistTokens({ access_token: token, expires_in: 3600 });
  return {
    accountLabel: "Google Account",
    accessToken: token,
  };
}

/** Disconnect: clear all stored tokens. */
export async function disconnectDrive(): Promise<void> {
  clearStoredTokens();
}

/* -------------------------------------------------------------------------- */
/*  Access token management                                                   */
/* -------------------------------------------------------------------------- */

/** Return a valid access token, refreshing if necessary. */
export async function getValidAccessToken(): Promise<string> {
  if (accessToken && Date.now() < expiresAt) return accessToken;

  const refreshToken = getStored<string>(REFRESH_TOKEN_KEY);
  if (!refreshToken) {
    throw new Error("No refresh token available. Please reconnect Google Drive.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: CLIENT_ID!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    clearStoredTokens();
    throw new Error("Drive session expired. Please reconnect Google Drive.");
  }

  const data = await res.json();
  persistTokens(data as { access_token: string; expires_in: number });
  return accessToken!;
}

/* -------------------------------------------------------------------------- */
/*  Drive API requests                                                        */
/* -------------------------------------------------------------------------- */

/** Make an authenticated request to the Drive REST API. */
export async function driveRequest(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getValidAccessToken();
  const url = path.startsWith("http") ? path : `${DRIVE_API}${path}`;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    accessToken = null;
    expiresAt = 0;
    const retryToken = await getValidAccessToken();
    return driveRequest(path, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${retryToken}` } });
  }
  return res;
}

/* -------------------------------------------------------------------------- */
/*  Backup folder                                                             */
/* -------------------------------------------------------------------------- */

/** Find the backup folder by name, creating it if it does not exist. */
export async function ensureBackupFolder(): Promise<string> {
  const q = encodeURIComponent(
    `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const res = await driveRequest(`/files?q=${q}&fields=files(id,name)&orderBy=createdTime desc`);
  const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }

  const createRes = await driveRequest("/files", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: BACKUP_FOLDER_NAME,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`Could not create Drive backup folder: ${createRes.status} ${text}`);
  }
  const created = (await createRes.json()) as { id: string };
  return created.id;
}

/**
 * List backup files in the folder. Returns manifests sorted newest first.
 */
export async function listDriveBackups(): Promise<BackupManifest[]> {
  const folderId = await ensureBackupFolder();
  const q = encodeURIComponent(
    `'${folderId}' in parents and trashed = false and mimeType = 'application/json'`,
  );
  const res = await driveRequest(
    `/files?q=${q}&fields=files(id,name,size,createdTime,modifiedTime)&orderBy=createdTime desc`,
  );
  const data = (await res.json()) as {
    files?: Array<{ id: string; name: string; size?: string; createdTime: string; modifiedTime: string }>;
  };
  return (
    data.files?.map((f) => ({
      id: f.id,
      label: f.name,
      createdAt: f.createdTime ?? f.modifiedTime ?? new Date().toISOString(),
      revision: 0,
      sizeBytes: f.size ? Number(f.size) : undefined,
      schemaVersion: 1,
    })) ?? []
  );
}

/**
 * Download a backup file's contents as text (the JSON payload).
 */
export async function downloadDriveFile(fileId: string): Promise<string> {
  const res = await driveRequest(`/files/${fileId}?alt=media`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive download failed: ${res.status} ${text}`);
  }
  return res.text();
}

/**
 * Upload (or replace) a backup file. If a file with the same name exists in
 * the folder it is updated as a new revision; otherwise a new file is created.
 */
export async function uploadDriveFile(
  filename: string,
  content: string,
  existingFileId?: string,
): Promise<BackupManifest> {
  const folderId = await ensureBackupFolder();
  const blob = new Blob([content], { type: "application/json" });

  if (existingFileId) {
    const res = await driveRequest(
      `${DRIVE_UPLOAD}/files/${existingFileId}?uploadType=media`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: blob,
      },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Drive upload failed: ${res.status} ${text}`);
    }
    const updated = (await res.json()) as { id: string; name: string; size?: string; createdTime: string };
    return {
      id: updated.id,
      label: updated.name,
      createdAt: updated.createdTime,
      revision: 0,
      sizeBytes: updated.size ? Number(updated.size) : undefined,
      schemaVersion: 1,
    };
  }

  const form = new FormData();
  const metadata = JSON.stringify({
    name: filename,
    parents: [folderId],
    mimeType: "application/json",
    description: "Pocket Ledger financial backup",
  });
  form.append("metadata", new Blob([metadata], { type: "application/json" }));
  form.append("file", blob, filename);

  const res = await driveRequest(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive upload failed: ${res.status} ${text}`);
  }
  const created = (await res.json()) as { id: string; name: string; size?: string; createdTime: string };
  return {
    id: created.id,
    label: created.name,
    createdAt: created.createdTime,
    revision: 0,
    sizeBytes: created.size ? Number(created.size) : undefined,
    schemaVersion: 1,
  };
}

/**
 * Trash (soft-delete) a backup file from Drive.
 */
export async function trashDriveFile(fileId: string): Promise<void> {
  const res = await driveRequest(`/files/${fileId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive delete failed: ${res.status} ${text}`);
  }
}

loadStoredTokens();