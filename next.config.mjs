import { execSync } from "node:child_process";

/**
 * A short label identifying this build, baked in at build time: the commit it
 * came from, plus when it was built. It ends up in two places — the server's
 * `/api/board` payload and the client bundle each screen loaded — and the gap
 * between those two is the thing worth seeing. See lib/build.ts.
 */
function buildStamp() {
  const git = (args) =>
    execSync(`git ${args}`, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();

  let commit = "los"; // "loose": no commit behind this build.
  try {
    // A dirty tree is the normal state on a laptop and a warning sign on the
    // host, where a build should only ever follow a clean `git pull`.
    commit = git("rev-parse --short HEAD") + (git("status --porcelain") ? "*" : "");
  } catch {
    // Not a git checkout (a copied tree, or a tarball) — the timestamp below
    // still tells one build from the next, which is most of the value.
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const when =
    `${pad(now.getDate())}-${pad(now.getMonth() + 1)} ` +
    `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return `${commit} · ${when}`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Cloud Run: ship a minimal server bundle instead of the whole node_modules tree.
  output: "standalone",
  // The dev badge sits exactly where the message zone is — hide it so what you
  // see locally is what the kiosk shows.
  devIndicators: false,
  // Inlined into the server *and* the client bundle at build time, so the two
  // can be compared later.
  env: { NEXT_PUBLIC_BUILD: buildStamp() },
};

export default nextConfig;
