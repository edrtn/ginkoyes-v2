#!/usr/bin/env node

/**
 * Build script for Ginkoyes Electron app
 * 1. Build Next.js (standalone)
 * 2. Compile Electron TypeScript
 * 3. Package with electron-builder
 */

import { execSync } from "child_process";
import { cpSync, existsSync, mkdirSync } from "fs";
import path from "path";

const root = process.cwd();

function run(cmd, label) {
  console.log(`\n=== ${label} ===`);
  execSync(cmd, { stdio: "inherit", cwd: root });
}

// Step 1: Build Next.js
run("npx next build", "Building Next.js (standalone)");

// Verify standalone output exists
const standalonePath = path.join(root, ".next", "standalone");
if (!existsSync(standalonePath)) {
  console.error("ERROR: .next/standalone not found. Make sure next.config.ts has output: 'standalone'");
  process.exit(1);
}

// Copy static files into standalone (required by Next.js standalone)
const staticSrc = path.join(root, ".next", "static");
const staticDest = path.join(standalonePath, ".next", "static");
if (existsSync(staticSrc)) {
  console.log("\nCopying .next/static into standalone...");
  mkdirSync(staticDest, { recursive: true });
  cpSync(staticSrc, staticDest, { recursive: true });
}

const publicSrc = path.join(root, "public");
const publicDest = path.join(standalonePath, "public");
if (existsSync(publicSrc)) {
  console.log("Copying public/ into standalone...");
  mkdirSync(publicDest, { recursive: true });
  cpSync(publicSrc, publicDest, { recursive: true });
}

// Step 2: Compile Electron TypeScript
run("npx tsc -p tsconfig.electron.json", "Compiling Electron TypeScript");

// Step 3: Package with electron-builder
run("npx electron-builder", "Packaging with electron-builder");

console.log("\n=== Build complete! Check release/ directory ===");
