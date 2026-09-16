import { StructuredTool } from "@langchain/core/tools";
import { z } from "zod";

const PACKAGE_VERSION = "0.1.0";

export interface KudositySendSmsFields {
  /**
   * Kudosity V2 API key (`x-api-key`). Falls back to the
   * `KUDOSITY_API_KEY` environment variable.
   */
  apiKey?: string;
  /**
   * Default sender: a virtual number assigned to your account, or an
   * alphanumeric sender ID (max 11 chars). When set, the model does not
   * have to supply one per send.
   */
  defaultSender?: string;
  /** Override the API base URL. Defaults to Kudosity production. */
  baseUrl?: string;
}

/** Flat response returned by POST /v2/sms (no `data` envelope). */
export interface KudositySmsResponse {
  id: string;
  recipient: string;
  sender: string;
  message: string;
  status: string;
  message_ref?: string;
  /** NOTE: the API returns this as a string, e.g. "1". */
  sms_count?: string;
  created_at?: string;
  [key: string]: unknown;
}

const schema = z.object({
  recipient: z
    .string()
    .describe(
      "Destination phone number, local or E.164 international format, e.g. 61491570156"
    ),
  message: z.string().describe("The SMS body text to send."),
  sender: z
    .string()
    .optional()
    .describe(
      "Sender: a virtual number assigned to the Kudosity account or an alphanumeric sender ID (max 11 chars). Omit to use the tool's configured default sender."
    ),
  message_ref: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Optional reference echoed back in delivery webhooks — use an ID you can join on, like an order number."
    ),
});

/**
 * LangChain tool that sends an SMS through the Kudosity platform
 * (POST https://api.transmitmessage.com/v2/sms).
 *
 * ```ts
 * import { KudositySendSms } from "langchain-kudosity";
 *
 * const sms = new KudositySendSms({ defaultSender: "61481074185" });
 * const agent = createAgent({ model, tools: [sms] });
 * ```
 */
export class KudositySendSms extends StructuredTool<typeof schema> {
  static lc_name() {
    return "KudositySendSms";
  }

  name = "kudosity_send_sms";

  description =
    "Send an SMS text message to a phone number via the Kudosity messaging platform. " +
    "Use for notifications, reminders, alerts and follow-ups. " +
    "Returns the message id (for matching delivery webhooks) and status as JSON.";

  schema = schema;

  protected apiKey: string;

  protected defaultSender?: string;

  protected baseUrl: string;

  constructor(fields: KudositySendSmsFields = {}) {
    super();
    const apiKey =
      fields.apiKey ??
      (typeof process !== "undefined"
        ? process.env?.KUDOSITY_API_KEY
        : undefined);
    if (!apiKey) {
      throw new Error(
        "Kudosity API key not found. Pass `apiKey` or set the KUDOSITY_API_KEY environment variable (Kudosity dashboard → Developers → API Settings)."
      );
    }
    this.apiKey = apiKey;
    this.defaultSender = fields.defaultSender;
    this.baseUrl = fields.baseUrl ?? "https://api.transmitmessage.com";
  }

  protected async _call(input: z.infer<typeof schema>): Promise<string> {
    const sender = input.sender ?? this.defaultSender;
    if (!sender) {
      return JSON.stringify({
        error:
          "No sender provided. Supply `sender` in the tool input, or configure `defaultSender` on the tool.",
      });
    }

    const res = await fetch(`${this.baseUrl}/v2/sms`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        "User-Agent": `langchain-kudosity/${PACKAGE_VERSION}`,
      },
      body: JSON.stringify({
        recipient: input.recipient,
        message: input.message,
        sender,
        ...(input.message_ref ? { message_ref: input.message_ref } : {}),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      // Kudosity errors follow RFC 9457 Problem Details under an `error` key;
      // `error.issues[]` lists every failed field at once.
      return JSON.stringify({
        error: `Kudosity API error (HTTP ${res.status})`,
        detail: body.error ?? body,
      });
    }

    // The SMS response is flat (some other V2 endpoints wrap in `data`).
    const sms = ((body as { data?: unknown }).data ??
      body) as KudositySmsResponse;
    return JSON.stringify({
      id: sms.id,
      status: sms.status,
      recipient: sms.recipient,
      sender: sms.sender,
      sms_count: sms.sms_count,
      message_ref: sms.message_ref,
    });
  }
}
