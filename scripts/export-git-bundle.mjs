#!/usr/bin/env node
/**
 * Export the committed repository without requiring a Git hosting provider.
 *
 * By default the bundle is written in the project root, outside the web app.
 * Pass --preview to publish a copy under public/downloads for a temporary
 * preview. Anyone who knows that URL can download the repository, so only use
 * that option when you intend to share the complete committed Git history.
 *
 * Git bundles contain committed objects only: ignored files, local credentials,
 * node_modules, and the application's browser-side IndexedDB are not included.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

if (args.some((arg) => arg !== "--preview")) {
  console.error("Usage: node scripts/export-git-bundle.mjs [--preview]");
  process.exit(1);
}

const preview = args.includes("--preview");
const filename = preview
  ? `pocket-ledger-${randomBytes(12).toString("hex")}.bundle`
  : "pocket-ledger.bundle";
const destination = preview
  ? join(root, "public", "downloads", filename)
  : join(root, filename);
const temporary = `${destination}.tmp`;

function git(...command) {
  return execFileSync("git", command, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

try {
  const changes = git("status", "--porcelain", "--untracked-files=all");
  if (changes) {
    console.error("Commit or otherwise save your working-tree changes before exporting.");
    console.error("A Git bundle contains committed history only.");
    process.exit(1);
  }

  mkdirSync(dirname(destination), { recursive: true });
  rmSync(temporary, { force: true });
  git("bundle", "create", temporary, "--all", "HEAD");
  git("bundle", "verify", temporary);
  rmSync(destination, { force: true });
  renameSync(temporary, destination);

  const head = git("rev-parse", "--short", "HEAD");
  const commits = git("rev-list", "--count", "HEAD");
  console.log(`Created ${destination}`);
  console.log(`Includes ${commits} commits through ${head}.`);
  if (preview) {
    console.log(`Temporary preview path: /downloads/${filename}`);
    console.log("Anyone with that link can download the source and its committed history.");
  } else {
    console.log("This file is not served by the app; move it to your other machine privately.");
  }
  console.log("Browser data and ignored files are not included.");
} catch (error) {
  rmSync(temporary, { force: true });
  console.error("Could not create the Git bundle. Make sure Git is installed and this is a Git repository.");
  if (error instanceof Error) console.error(error.message);
  process.exit(1);
}
