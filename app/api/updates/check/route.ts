import { NextResponse } from "next/server";
import { execSync } from "child_process";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cwd = process.cwd();

    // Fetch latest changes from remote
    execSync("git fetch origin main", { cwd, timeout: 15000 });

    const currentCommit = execSync("git rev-parse HEAD", { cwd })
      .toString()
      .trim();
    const remoteCommit = execSync("git rev-parse origin/main", { cwd })
      .toString()
      .trim();

    let behindCount = 0;
    if (currentCommit !== remoteCommit) {
      const count = execSync(
        `git rev-list --count HEAD..origin/main`,
        { cwd }
      )
        .toString()
        .trim();
      behindCount = parseInt(count, 10) || 0;
    }

    return NextResponse.json({
      updateAvailable: behindCount > 0,
      currentCommit: currentCommit.slice(0, 7),
      remoteCommit: remoteCommit.slice(0, 7),
      behindCount,
    });
  } catch (err) {
    return NextResponse.json(
      { error: String(err instanceof Error ? err.message : err) },
      { status: 500 }
    );
  }
}
