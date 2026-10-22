import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

// Print paths and rule names only; never echo a credential or matching line.
const excluded = new Set([
  "node_modules",
  ".git",
  ".vercel",
  "coverage",
  "test-results",
  "playwright-report",
]);
function filesIn(directory = ".") {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (excluded.has(entry.name) || entry.name.startsWith(".next")) return [];
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) return [];
    if (entry.isDirectory()) return filesIn(file);
    // Untracked local env files must never be printed or scanned into output.
    return entry.name.startsWith(".env") && entry.name !== ".env.example"
      ? []
      : [file];
  });
}
let files;
let stagedFiles = [];
let gitAvailable = false;
try {
  files = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
  )
    .split("\0")
    .filter(Boolean);
  gitAvailable = true;
  stagedFiles = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"],
    { encoding: "utf8" },
  )
    .split("\0")
    .filter(Boolean);
} catch {
  files = filesIn();
}
const findings = [];
function inspect(file, read) {
  const basename = path.basename(file);
  if (
    (basename.startsWith(".env") && basename !== ".env.example") ||
    /\.(?:pem|key|p12|pfx)$/.test(file) ||
    /(?:^|\/)(?:credentials|service-account|supabase-status)[^/]*\.json$/.test(
      file,
    )
  ) {
    findings.push(`${file}: credential file must be ignored and untracked`);
    return;
  }
  if (file.startsWith(".vercel/")) {
    findings.push(`${file}: Vercel local state must be ignored and untracked`);
    return;
  }
  const buffer = read();
  if (
    buffer.includes(0) ||
    /\.(?:png|jpe?g|webp|gif|ico|woff2?|tsbuildinfo)$/.test(file)
  )
    return;
  buffer
    .toString("utf8")
    .split(/\r?\n/)
    .forEach((line, index) => {
      if (
        basename === ".env.example" &&
        /^\s*(?:NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|NEXT_PUBLIC_APP_URL)\s*=\s*[^\s#]/.test(
          line,
        )
      )
        findings.push(
          `${file}:${index + 1}: credential/origin template must stay empty`,
        );
      const rules = [
        ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{16,}\b/],
        [
          "provider token",
          /\b(?:sbp_|ghp_|github_pat_|sk_live_)[A-Za-z0-9_]{20,}\b/,
        ],
        ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
        [
          "database connection with password",
          /\bpostgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/,
        ],
        ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
      ];
      for (const [rule, pattern] of rules)
        if (pattern.test(line)) findings.push(`${file}:${index + 1}: ${rule}`);
      for (const jwt of line.matchAll(
        /\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g,
      )) {
        try {
          const payload = JSON.parse(
            Buffer.from(jwt[1], "base64url").toString("utf8"),
          );
          if (
            payload.role === "service_role" ||
            payload.role === "supabase_admin"
          )
            findings.push(`${file}:${index + 1}: elevated JWT`);
        } catch {
          /* Not a JWT payload. */
        }
      }
      if (
        /^\s*NEXT_PUBLIC_(?:\w*(?:PASSWORD|SECRET|SERVICE_ROLE|PRIVATE_KEY|ACCESS_TOKEN)\w*)\s*=\s*\S+/.test(
          line,
        )
      )
        findings.push(
          `${file}:${index + 1}: secret in public environment variable`,
        );
    });
}
for (const file of new Set(files)) {
  if (existsSync(file)) inspect(file, () => readFileSync(file));
}
// A cleaned working copy must not hide a credential already staged for commit.
for (const file of stagedFiles) {
  inspect(file, () =>
    execFileSync("git", ["show", `:${file}`], { maxBuffer: 16 * 1024 * 1024 }),
  );
}
if (findings.length) {
  process.stderr.write(`Credential check failed:\n${findings.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Credential check passed (${gitAvailable ? "Git tracked/unignored files" : "source files; Git metadata unavailable"}). Local env contents were not printed.\n`,
  );
}
