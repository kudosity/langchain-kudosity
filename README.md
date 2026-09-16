# langchain-kudosity

LangChain.js tools for [Kudosity](https://kudosity.com) — let AI agents send **SMS, MMS and RCS** through the Kudosity messaging platform.

| Tool | Channel | Endpoint |
|---|---|---|
| `KudositySendSms` | SMS | `POST /v2/sms` |
| `KudositySendMms` | MMS — image/GIF/video/audio by public URL | `POST /v2/mms` |
| `KudositySendRcs` | RCS — rich, branded messaging with SMS fallback | `POST /v2/rcs/messages` |

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
  defaultSender: "YourAgentId", // a registered RCS agent ID, not a phone number
  defaultFallbackSender: "61481074185", // used when the model adds an SMS fallback
});
```

> **RCS note:** the RCS `sender` is a **registered RCS agent ID** provisioned by
> Kudosity — talk to your Kudosity contact to get one. The tool prompts the model to
> include `sms_fallback_message` so non-RCS handsets still get the message as SMS.

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
| `baseUrl` | `https://api.transmitmessage.com` | Override for testing |

### Tool input schema

| Field | Type | Notes |
|---|---|---|
| `recipient` | string, required | Local or E.164 format |
| `message` | string, required | SMS body |
| `sender` | string, optional | Overrides `defaultSender` per send |
| `message_ref` | string, optional | Echoed in delivery webhooks — set it to something you can join on |

The tool returns JSON with the message `id` — match it against [delivery webhooks](https://developers.kudosity.com/) (`SMS_STATUS`, `SMS_INBOUND`) for delivery receipts and replies.

## Related

- [Kudosity developer docs](https://developers.kudosity.com/)
- [Kudosity MCP server](https://github.com/kudosity/mcp) — 19 messaging tools over MCP
- [Kudosity agent skills](https://github.com/kudosity/skills) — SMS/MMS/WhatsApp/RCS knowledge for coding agents
- [AI agent examples](https://github.com/kudosity/ai-agent-examples) — runnable end-to-end examples

## License

MIT
