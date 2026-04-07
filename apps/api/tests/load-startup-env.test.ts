import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, loadStartupEnv, resolveEnvFileCandidates } from "../src/config/load-startup-env";

const tempRoots: string[] = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) continue;
    rmSync(root, { recursive: true, force: true });
  }
});

function createTempLayout() {
  const root = mkdtempSync(join(tmpdir(), "sta-env-"));
  tempRoots.push(root);

  const appDir = join(root, "apps", "api");
  const configDir = join(appDir, "src", "config");
  mkdirSync(configDir, { recursive: true });

  return { root, appDir, configDir };
}

describe("startup env loader", () => {
  it("prefers root .env before app-local .env", () => {
    const { root, appDir, configDir } = createTempLayout();

    writeFileSync(resolve(root, ".env"), "DATA_SOURCE=supabase\nDEV_FALLBACK_ROLE=Admin\n", "utf8");
    writeFileSync(resolve(appDir, ".env"), "DATA_SOURCE=memory\nDEV_FALLBACK_ROLE=User\n", "utf8");

    const targetEnv = {} as NodeJS.ProcessEnv;
    const loadedPath = loadStartupEnv({ cwd: appDir, dirname: configDir, targetEnv });

    expect(loadedPath).toBe(resolve(root, ".env"));
    expect(targetEnv.DATA_SOURCE).toBe("supabase");
    expect(targetEnv.DEV_FALLBACK_ROLE).toBe("Admin");
  });

  it("does not overwrite existing process values", () => {
    const { root } = createTempLayout();
    const envPath = resolve(root, ".env");
    writeFileSync(envPath, "API_AUTH_REQUIRED=false\nDEV_FALLBACK_ROLE=Admin\n", "utf8");

    const targetEnv = {
      API_AUTH_REQUIRED: "true"
    } as NodeJS.ProcessEnv;

    loadEnvFile(envPath, targetEnv);

    expect(targetEnv.API_AUTH_REQUIRED).toBe("true");
    expect(targetEnv.DEV_FALLBACK_ROLE).toBe("Admin");
  });

  it("returns deterministic candidate order", () => {
    const { root, appDir, configDir } = createTempLayout();
    const candidates = resolveEnvFileCandidates({ cwd: appDir, dirname: configDir });

    expect(candidates[0]).toBe(resolve(root, ".env"));
    expect(candidates).toContain(resolve(appDir, ".env"));
  });
});
