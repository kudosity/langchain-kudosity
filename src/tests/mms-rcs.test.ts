import { afterEach, describe, expect, it, vi } from "vitest";
import { KudositySendMms } from "../mms.js";
import { KudositySendRcs } from "../rcs.js";

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const call = (fetch: ReturnType<typeof mockFetch>) =>
  fetch.mock.calls[0] as unknown as [
    string,
    { headers: Record<string, string>; body: string }
  ];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KudositySendMms", () => {
  it("sends to /v2/mms with content_urls (flat response)", async () => {
    const fetch = mockFetch(200, {
      id: "mms-1",
      status: "pending",
      recipient: "61435795809",
      sender: "61481074185",
      content_urls: ["https://example.com/a.jpg"],
    });
    const tool = new KudositySendMms({
      apiKey: "k",
      defaultSender: "61481074185",
    });
    const out = JSON.parse(
      await tool.invoke({
        recipient: "61435795809",
        content_urls: ["https://example.com/a.jpg"],
        subject: "New Arrival",
        message: "Check it out!",
      })
    );
    const [url, init] = call(fetch);
    expect(url).toBe("https://api.transmitmessage.com/v2/mms");
    expect(JSON.parse(init.body)).toEqual({
      recipient: "61435795809",
      content_urls: ["https://example.com/a.jpg"],
      sender: "61481074185",
      message: "Check it out!",
      subject: "New Arrival",
    });
    expect(out.id).toBe("mms-1");
    expect(out.status).toBe("pending");
  });
});

describe("KudositySendRcs", () => {
  it("sends to /v2/rcs/messages with nested content and unwraps the data envelope", async () => {
    const fetch = mockFetch(200, {
      data: { id: "rcs-1", recipient: "61438333061", sender: "DemoSender" },
      request: {},
      meta: {},
    });
    const tool = new KudositySendRcs({
      apiKey: "k",
      defaultSender: "DemoSender",
      defaultFallbackSender: "61481074185",
    });
    const out = JSON.parse(
      await tool.invoke({
        recipient: "61438333061",
        message: "Your order shipped.",
        sms_fallback_message: "Your order shipped (SMS).",
      })
    );
    const [url, init] = call(fetch);
    expect(url).toBe("https://api.transmitmessage.com/v2/rcs/messages");
    expect(JSON.parse(init.body)).toEqual({
      sender: "DemoSender",
      recipient: "61438333061",
      content_type: "text",
      content: { text: { message: "Your order shipped." } },
      sms_fallback: {
        message: "Your order shipped (SMS).",
        sender: "61481074185",
      },
    });
    expect(out.id).toBe("rcs-1");
  });

  it("omits sms_fallback when no fallback message is given", async () => {
    const fetch = mockFetch(200, { data: { id: "rcs-2" } });
    const tool = new KudositySendRcs({ apiKey: "k", defaultSender: "Demo" });
    await tool.invoke({ recipient: "61438333061", message: "hi" });
    expect(JSON.parse(call(fetch)[1].body)).not.toHaveProperty("sms_fallback");
  });

  it("asks for an RCS agent ID when no sender is configured", async () => {
    mockFetch(200, { data: { id: "x" } });
    const tool = new KudositySendRcs({ apiKey: "k" });
    const out = JSON.parse(
      await tool.invoke({ recipient: "61438333061", message: "hi" })
    );
    expect(out.error).toMatch(/RCS agent ID/);
  });
});
