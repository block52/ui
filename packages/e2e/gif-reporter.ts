import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";
import { execFile } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

/**
 * GifReporter — turns every e2e test's recorded video into an animated GIF for
 * quick visual review (the action-feedback pill, animations, the whole hand).
 *
 * Pairs with `video: "on"` in playwright.config.ts: Playwright finalizes each
 * test's .webm and attaches it before onTestEnd fires, so we just convert that
 * attachment to a GIF with ffmpeg. Full-frame (no cropping) — the video is
 * captured at Playwright's default downscaled size, and we scale to a review
 * width and cap the frame rate to keep the files light.
 *
 * ffmpeg is preinstalled on GitHub's ubuntu-latest runners; if it is missing
 * (or a conversion fails) the GIF is skipped silently — the .webm is still in
 * the Playwright HTML report either way. GIFs land in packages/e2e/artifacts/,
 * which CI uploads as an artifact.
 */

const execFileAsync = promisify(execFile);
const ARTIFACTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "artifacts");
const GIF_FPS = 12;
const GIF_WIDTH = 640; // scale full frame down for review; -1 keeps aspect

function slug(s: string): string {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

export default class GifReporter implements Reporter {
    private jobs: Promise<void>[] = [];

    onTestEnd(test: TestCase, result: TestResult): void {
        const video = result.attachments.find(a => a.name === "video" && a.path);
        if (!video?.path || !existsSync(video.path)) return;

        const specName = basename(test.location.file).replace(/\.spec\.ts$/, "");
        const suffix = result.retry > 0 ? `-retry${result.retry}` : "";
        const outPath = join(ARTIFACTS_DIR, `${specName}--${slug(test.title)}${suffix}.gif`);
        this.jobs.push(this.convert(video.path, outPath));
    }

    private async convert(src: string, out: string): Promise<void> {
        try {
            mkdirSync(dirname(out), { recursive: true });
            // Two-pass palette for clean color at small size.
            await execFileAsync("ffmpeg", [
                "-y",
                "-i",
                src,
                "-filter_complex",
                `fps=${GIF_FPS},scale=${GIF_WIDTH}:-1:flags=lanczos,split [a][b];[a] palettegen [p];[b][p] paletteuse`,
                "-loop",
                "0",
                out
            ]);
        } catch {
            // ffmpeg missing or conversion failed — skip (the .webm remains in the report).
        }
    }

    async onEnd(): Promise<void> {
        await Promise.allSettled(this.jobs);
    }
}
