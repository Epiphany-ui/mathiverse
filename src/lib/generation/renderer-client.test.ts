import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRendererClient, RendererError } from "./renderer-client";
import type { RendererClient } from "./renderer-client";

type MockFetch = (url: string | URL, init?: RequestInit) => Promise<Response>;

function mockFetchFn(responses: Record<string, Response>): MockFetch {
  return async (url: string | URL, init?: RequestInit) => {
    const key = typeof url === "string" ? url : url.toString();
    // Match by path suffix
    for (const [suffix, res] of Object.entries(responses)) {
      if (key.endsWith(suffix) || key.includes(suffix)) {
        return res;
      }
    }
    return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  };
}

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("RendererClient", () => {
  function makeClient(responses: Record<string, Response>): RendererClient {
    return createRendererClient({
      baseUrl: "http://test:9876",
      fetchImpl: mockFetchFn(responses) as unknown as typeof fetch,
    });
  }

  describe("validateManim", () => {
    it("maps a successful validation response", async () => {
      const client = makeClient({
        "/validate": jsonRes({
          valid: true,
          scene_name: "UnitCircle",
          issues: [],
        }),
      });
      const result = await client.validateManim("from manim import *");
      assert.equal(result.valid, true);
      assert.equal(result.sceneName, "UnitCircle");
      assert.equal(result.issues.length, 0);
    });

    it("throws RendererError with issues on validation failure", async () => {
      const client = makeClient({
        "/validate": jsonRes(
          {
            valid: false,
            scene_name: null,
            error: "Validation failed",
            diagnostics: [
              { code: "syntax", message: "bad syntax", line: 3 },
            ],
          },
          422,
        ),
      });
      await assert.rejects(
        () => client.validateManim("bad code"),
        (err: unknown) => {
          if (!(err instanceof RendererError)) return false;
          assert.equal(err.status, 422);
          assert.equal(err.issues.length, 1);
          assert.equal(err.issues[0].line, 3);
          return true;
        },
      );
    });
  });

  describe("renderManim", () => {
    it("preserves cacheHit and renderKey", async () => {
      const client = makeClient({
        "/render": jsonRes({
          success: true,
          video_url: "http://test:9876/output/vid.mp4",
          gif_url: null,
          duration: 4.2,
          scene_name: "Test",
          render_key: "abc123def456",
          cache_hit: true,
          diagnostics: [],
        }),
      });
      const artifact = await client.renderManim({
        code: "from manim import *",
        quality: "-ql",
        format: "mp4",
        requestId: "req-1",
      });
      assert.equal(artifact.url, "http://test:9876/output/vid.mp4");
      assert.equal(artifact.renderKey, "abc123def456");
      assert.equal(artifact.cacheHit, true);
      assert.equal(artifact.duration, 4.2);
    });
  });

  describe("cancelManimRender", () => {
    it("sends DELETE to the correct URL", async () => {
      let deletedUrl = "";
      const client = createRendererClient({
        baseUrl: "http://test:9876",
        fetchImpl: (async (url: string | URL, init?: RequestInit) => {
          deletedUrl = typeof url === "string" ? url : url.toString();
          return jsonRes({ cancelled: true });
        }) as unknown as typeof fetch,
      });
      const result = await client.cancelManimRender("req-1");
      assert.equal(result, true);
      assert.ok(deletedUrl.includes("/render/"));
      assert.ok(deletedUrl.includes("req-1"));
    });
  });

  describe("RendererError", () => {
    it("classifies 422 with line-numbered diagnostic", () => {
      const err = new RendererError(422, "Validation failed", [
        { code: "syntax", message: "unexpected token", line: 7 },
      ]);
      assert.equal(err.status, 422);
      assert.equal(err.retryable, false);
      assert.equal(err.issues[0].line, 7);
    });

    it("classifies 429 as retryable", () => {
      const err = new RendererError(429, "Rate limited");
      assert.equal(err.retryable, true);
    });
  });
});
