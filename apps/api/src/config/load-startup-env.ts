import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

interface ResolveEnvFileCandidatesOptions {
  cwd?: string;
  dirname?: string;
}

interface LoadStartupEnvOptions extends ResolveEnvFileCandidatesOptions {
  targetEnv?: NodeJS.ProcessEnv;
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const separator = trimmed.indexOf("=");
  if (separator <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separator).trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    return null;
  }

  let value = trimmed.slice(separator + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return [key, value];
}

export function loadEnvFile(filePath: string, targetEnv: NodeJS.ProcessEnv = process.env): void {
  const content = readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const parsed = parseEnvLine(line);
    if (!parsed) continue;

    const [key, value] = parsed;
    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
}

export function resolveEnvFileCandidates(options: ResolveEnvFileCandidatesOptions = {}): string[] {
  const cwd = options.cwd ?? process.cwd();
  const dirname = options.dirname ?? __dirname;

  const candidates = [
    resolve(dirname, "../../../../.env"), // repo root .env
    resolve(dirname, "../../.env"), // apps/api/.env
    resolve(cwd, ".env") // current working directory
  ];

  return [...new Set(candidates)];
}

export function loadStartupEnv(options: LoadStartupEnvOptions = {}): string | null {
  const targetEnv = options.targetEnv ?? process.env;
  const candidates = resolveEnvFileCandidates(options);

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    loadEnvFile(candidate, targetEnv);
    return candidate;
  }

  return null;
}
