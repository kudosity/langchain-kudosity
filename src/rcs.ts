import { z } from "zod";
import { KudosityTool, type KudosityToolFields } from "./base.js";

export interface KudositySendRcsFields extends KudosityToolFields {
  /**
   * Default SMS fallback sender (a number or alphanumeric sender ID on
   * your account) used when the model supplies a fallback message but no
   * fallback sender.
   */
  defaultFallbackSender?: string;
}

const schema = z.object({
  recipient: z
    .string()
    .describe(
      "Destination phone number, local or E.164 international format, e.g. 61491570156"
    ),
  message: z
    .string()
    .max(3072)
    .describe("The RCS message text to send (up to 3072 characters)."),
  sender: z
    .string()
    .optional()
    .describe(
      "The registered RCS agent ID to send from (e.g. 'DemoSender') — NOT a phone number. Omit to use the tool's configured default sender."
    ),
  sms_fallback_message: z
    .string()
    .optional()
    .describe(
      "STRONGLY RECOMMENDED: a shorter plain-text version sent as a regular SMS when the recipient's device can't receive RCS. Without it, non-RCS handsets get nothing."
    ),
  message_ref: z
    .string()
    .max(500)
    .optional()
    .describe(
      "Optional reference echoed back in delivery webhooks — use an ID you can join on."
    ),
});

/**
 * LangChain tool that sends an RCS (rich, branded) message through the
 * Kudosity platform (POST https://api.transmitmessage.com/v2/rcs/messages),
 * with optional automatic SMS fallback for non-RCS devices.
 *
 * RCS sends from a **registered RCS agent ID**, not a phone number — the
 * agent must be provisioned by Kudosity and launched on the destination
 * carrier before it will deliver.
 */
export class KudositySendRcs extends KudosityTool<typeof schema> {
  static lc_name() {
    return "KudositySendRcs";
  }

  name = "kudosity_send_rcs";

  description =
    "Send an RCS (rich, branded) message to a phone number via the Kudosity messaging platform, " +
    "with optional SMS fallback for devices that can't receive RCS — include the fallback on almost every send. " +
    "The sender is a registered RCS agent ID, never a phone number. " +
    "Returns the message id (for matching delivery webhooks, including READ receipts) as JSON.";

  schema = schema;

  protected defaultFallbackSender?: string;

  constructor(fields: KudositySendRcsFields = {}) {
    super(fields);
    this.defaultFallbackSender = fields.defaultFallbackSender;
  }

  protected async _call(input: z.infer<typeof schema>): Promise<string> {
    const sender = input.sender ?? this.defaultSender;
    if (!sender) return this.missingSenderError("RCS agent ID");

    const fallbackSender =
      this.defaultFallbackSender && input.sms_fallback_message
        ? this.defaultFallbackSender
        : undefined;

    const res = await this.post("/v2/rcs/messages", {
      sender,
      recipient: input.recipient,
      content_type: "text",
      content: { text: { message: input.message } },
      ...(input.sms_fallback_message
        ? {
            sms_fallback: {
              message: input.sms_fallback_message,
              ...(fallbackSender ? { sender: fallbackSender } : {}),
            },
          }
        : {}),
      ...(input.message_ref ? { message_ref: input.message_ref } : {}),
    });
    if (!res.ok) return JSON.stringify(res.error);

    // RCS responses are wrapped in a `data` envelope (unwrapped by post()).
    const rcs = res.body;
    return JSON.stringify({
      id: rcs.id,
      recipient: rcs.recipient,
      sender: rcs.sender,
      created_at: rcs.created_at,
      message_ref: rcs.message_ref,
    });
  }
}
