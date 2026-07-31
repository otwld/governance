import { tool } from "@opencode-ai/plugin";

function safeStderr(value) {
  return value
    .trim()
    .replace(/(authorization:\s*(?:bearer|token)\s+)\S+/gi, "$1[redacted]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]+)\b/g, "[redacted]");
}

export default tool({
  description: "Create one approved plain GitHub issue and return its URL.",
  args: {
    repo: tool.schema.string().min(1),
    title: tool.schema.string().min(1),
    body: tool.schema.string().min(1),
  },
  async execute({ repo, title, body }) {
    const process = Bun.spawn(
      ["gh", "issue", "create", "--repo", repo, "--title", title, "--body", body],
      { stdout: "pipe", stderr: "pipe" },
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      process.exited,
      new Response(process.stdout).text(),
      new Response(process.stderr).text(),
    ]);

    if (exitCode !== 0) {
      const detail = safeStderr(stderr);
      throw new Error(
        `gh issue create failed with exit code ${exitCode}: ${detail || "no stderr output"}`,
      );
    }

    const result = stdout.trim();
    if (result === "") {
      throw new Error("gh issue create exited successfully without returning an issue URL");
    }
    return result;
  },
});
