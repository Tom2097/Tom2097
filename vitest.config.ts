import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Parallel agent worktrees (.claude/worktrees/agent-*) contain full
    // copies of this repo, including its test files -- without this,
    // running vitest while an agent worktree exists silently triples the
    // suite and can surface failures from an agent's mid-edit state that
    // have nothing to do with the change actually being verified here.
    exclude: ["**/node_modules/**", "**/.claude/worktrees/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
})
