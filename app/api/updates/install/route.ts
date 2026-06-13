import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function POST() {
  const logs: string[] = [];
  const cwd = process.cwd();

  try {
    // Step 1: git pull
    logs.push("$ git pull origin main");
    const pullOutput = execSync("git pull origin main", {
      cwd,
      timeout: 30000,
    })
      .toString()
      .trim();
    logs.push(pullOutput);

    // Step 2: npm install
    logs.push("$ npm install");
    const installOutput = execSync("npm install", {
      cwd,
      timeout: 120000,
    })
      .toString()
      .trim();
    logs.push(installOutput);

    // Step 3: npm run build
    logs.push("$ npm run build");
    const buildOutput = execSync("npm run build", {
      cwd,
      timeout: 180000,
    })
      .toString()
      .trim();
    logs.push(buildOutput);

    return NextResponse.json({
      success: true,
      message: "Mise a jour installee. Redemarrez le dashboard pour appliquer.",
      logs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logs.push(`ERREUR: ${message}`);
    return NextResponse.json(
      { success: false, message, logs },
      { status: 500 }
    );
  }
}
