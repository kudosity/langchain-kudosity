# langchain-kudosity

LangChain.js tools for [Kudosity](https://kudosity.com) — let AI agents send **SMS, MMS and RCS** through the Kudosity messaging platform.

| Tool | Channel | Endpoint |
|---|---|---|
| `KudositySendSms` | SMS | `POST /v2/sms` |
| `KudositySendMms` | MMS — image/GIF/video/audio by public URL | `POST /v2/mms` |
| `KudositySendRcs` | RCS — text, media, rich cards and carousels, with suggested replies, buttons and SMS fallback | `POST /v2/rcs/messages` |

```bash
npm install langchain-kudosity @langchain/core
```

## Setup

Get your API key from the Kudosity dashboard under **Developers → API Settings** and set it in the environment:

```bash
export KUDOSITY_API_KEY="your-api-key"
```

## Usage

```ts
import { KudositySendSms } from "langchain-kudosity";

const sendSms = new KudositySendSms({
  // a virtual number on your account, or an alphanumeric sender ID (max 11 chars)
  defaultSender: "61481074185",
});

// Standalone:
const result = await sendSms.invoke({
  recipient: "61491570156",
  message: "Your appointment is tomorrow at 10am. Reply STOP to opt out.",
});
// → {"id":"2d2c8fb6-…","status":"queued","recipient":"61491570156",…}
```

MMS and RCS work the same way:

```ts
import { KudositySendMms, KudositySendRcs } from "langchain-kudosity";

const sendMms = new KudositySendMms({ defaultSender: "61481074185" });

const sendRcs = new KudositySendRcs({
  defaultSender: "YourAgentId", // your RCS agent ID, not a phone number
  defaultFallbackSender: "61481074185", // the SMS sender for the fallback; without it, no fallback is sent
});
```

Or hand them to an agent:

```ts
import { createAgent } from "langchain";

const agent = createAgent({
  model: "anthropic:claude-sonnet-5",
  tools: [sendSms, sendMms, sendRcs],
});

await agent.invoke({
  messages: [
    {
      role: "user",
      content: "Text 61491570156 that their delivery arrives Thursday.",
    },
  ],
});
```

### Options

| Option | Default | Notes |
|---|---|---|
| `apiKey` | `KUDOSITY_API_KEY` env var | Kudosity V2 API key (`x-api-key`) |
| `defaultSender` | — | Used when the model doesn't supply a `sender`; without either, the tool returns an error message |
| `defaultFallbackSender` | — | `KudositySendRcs` only: the SMS sender for the fallback. Without it, no fallback SMS is sent |
| `baseUrl` | `https://api.transmitmessage.com` | Override for testing |

### SMS tool input

| Field | Type | Notes |
|---|---|---|
| `recipient` | string, required | Local or E.164 format |
| `message` | string, required | SMS body |
| `sender` | string, optional | Overrides `defaultSender` per send |
| `message_ref` | string, optional | Echoed in delivery webhooks — set it to something you can join on |

The tool returns JSON with the message `id` — match it against [delivery webhooks](https://developers.kudosity.com/) (`SMS_STATUS`, `SMS_INBOUND`) for delivery receipts and replies.

## RCS

`KudositySendRcs` sends text, an image or video, a rich card, or a carousel. Set exactly one of `message`, `media_url` or `cards`:

```ts
await sendRcs.invoke({
  recipient: "61491570156",
  cards: [
    {
      title: "Your order is out for delivery",
      description: "Order 12345 arrives today between 2pm and 4pm.",
      media_url: "https://example.com/images/van.jpg",
      suggestions: [
        { type: "open_url", text: "Track order", url: "https://example.com/track/12345" },
      ],
    },
  ],
  suggestions: [
    { type: "reply", text: "Reschedule", postback_data: "order-12345:reschedule" },
  ],
  sms_fallback_message:
    "Your order 12345 arrives today 2-4pm. Track: https://example.com/track/12345",
  message_ref: "order-12345",
});
```

| Field | Notes |
|---|---|
| `recipient` | E.164 international format, such as `61491570156`. Local format is rejected. |
| `message` | A text message, up to 3072 characters |
| `media_url` | One image or video on its own, by public `https` URL |
| `cards` | 1 card sends a rich card; 2 to 10 send a carousel. Each card takes `title`, `description`, `media_url` and up to 4 `suggestions` |
| `suggestions` | Up to 11 chips under the message. Each is a `reply`, an `open_url` or a `dial`, with an optional `postback_data` |
| `sms_fallback_message` | Plain text sent by SMS when the RCS message can't be delivered |
| `sender` | Overrides `defaultSender` for one send |
| `message_ref` | Echoed in delivery webhooks |

Things to get right:

- **The sender is your RCS agent ID, not a phone number.** You create, test and launch the agent in the Kudosity app under **RCS → RCS Agents**. Until it's launched, it can message its test devices only. See [RCS onboarding](https://developers.kudosity.com/docs/rcs-onboarding).
- **An SMS fallback needs a sender.** Kudosity doesn't send a fallback SMS without one, so set `defaultFallbackSender` to a number or sender ID that your account can send SMS from. If the model supplies a fallback message and no fallback sender is configured, the tool sends the RCS message without a fallback and returns a `warning`.
- **A returned `id` means accepted, not delivered.** Delivery and read receipts arrive on the `RCS_STATUS` webhook. A message that falls back to SMS reports on `SMS_STATUS` with the same `id`. See [Track an RCS message that falls back to SMS](https://developers.kudosity.com/docs/rcs-sms-fallback).
- **A tapped suggestion arrives as an `RCS_INBOUND` webhook event** with `mo.content_type` set to `SUGGESTION` and your `postback_data`. Route on `postback_data`, not on the label.
- **Media URLs must be public `https` URLs that don't redirect.** Kudosity fetches each file when you send, and a file it can't fetch fails the request.

The [RCS Message Guide](https://developers.kudosity.com/docs/rcs-message-guide) has the full rules for each format.

## Related

- [Kudosity developer docs](https://developers.kudosity.com/)
- [Kudosity MCP server](https://github.com/kudosity/mcp) — 19 messaging tools over MCP
- [Kudosity agent skills](https://github.com/kudosity/skills) — SMS/MMS/WhatsApp/RCS knowledge for coding agents
- [AI agent examples](https://github.com/kudosity/ai-agent-examples) — runnable end-to-end examples

## License

MIT
