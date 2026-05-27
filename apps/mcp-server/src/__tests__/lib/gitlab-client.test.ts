import { describe, it, expect } from "vitest";
import { gitlabApiBase } from "../../lib/gitlab-client.js";

describe("gitlabApiBase", () => {
  it("returns api/v4 base for gitlab.com SaaS", () => {
    expect(gitlabApiBase("https://gitlab.com/grupo/repo")).toBe(
      "https://gitlab.com/api/v4",
    );
  });

  it("returns api/v4 base for a self-hosted instance", () => {
    expect(gitlabApiBase("https://git.empresa.com.br/grupo/repo")).toBe(
      "https://git.empresa.com.br/api/v4",
    );
  });

  it("preserves http scheme for non-TLS instances", () => {
    expect(gitlabApiBase("http://gitlab.internal/grupo/repo")).toBe(
      "http://gitlab.internal/api/v4",
    );
  });

  it("preserves explicit port in self-hosted URL", () => {
    expect(gitlabApiBase("https://gitlab.internal:8443/grupo/repo")).toBe(
      "https://gitlab.internal:8443/api/v4",
    );
  });
});
