import type { z } from "zod";
import { KudosityTool, type KudosityToolFields } from "./base.js";
import { buildRcsRequest, rcsInputSchema } from "./rcs-request.js";

export interface KudositySendRcsFields extends KudosityToolFields {
  /**
   * SMS fallback sender: a number or alphanumeric sender ID that your
   * account can send SMS from. Kudosity doesn't send a fallback SMS without
   * a sender, so set this if you want fallback. When it isn't set, the tool
   * leaves the fallback out and returns a `warning`.
   */
  defaultFallbackSender?: string;
}

const schema = rcsInputSchema;

/**
 * LangChain tool that sends an RCS message through the Kudosity platform
 * (POST https://api.transmitmessage.com/v2/rcs/messages): text, an image or
 * video, a rich card, or a carousel, with suggested replies and actions and
 * an optional SMS fallback.
 *
 * RCS sends from an **RCS agent ID**, not a phone number. You create, test
 * and launch the agent in the Kudosity app under RCS > RCS Agents. Until the
 * agent is launched, it can message its test devices only.
 */
export class KudositySendRcs extends KudosityTool<typeof schema> {
  static lc_name() {
    return "KudositySendRcs";
  }

  name = "kudosity_send_rcs";

  description =
    "Send an RCS message to a phone number via the Kudosity messaging platform. " +
    "Send one of: text (`message`), an image or video on its own (`media_url`), or a rich card or carousel (`cards`: 1 card is a rich card, 2 to 10 are a carousel). " +
    "Add `suggestions` for tappable replies, links and call buttons. " +
    "Include `sms_fallback_message` on almost every send, so that recipients who can't receive RCS get an SMS. " +
    "The sender is an RCS agent ID, never a phone number. " +
    "Returns the message id as JSON. A returned id means the message was accepted, not delivered: delivery, read receipts and tapped suggestions arrive on webhooks.";

  schema = schema;

  protected defaultFallbackSender?: string;

  constructor(fields: KudositySendRcsFields = {}) {
    super(fields);
    this.defaultFallbackSender = fields.defaultFallbackSender;
  }

  protected async _call(input: z.infer<typeof schema>): Promise<string> {
    const sender = input.sender ?? this.defaultSender;
    if (!sender) return this.missingSenderError("RCS agent ID");

    const request = buildRcsRequest(input, {
      sender,
      fallbackSender: this.defaultFallbackSender,
    });
    if (!request.ok) return JSON.stringify(request.error);

    const res = await this.post("/v2/rcs/messages", request.payload);
    if (!res.ok) return JSON.stringify(res.error);

    // RCS responses are wrapped in a `data` envelope (unwrapped by post()).
    const rcs = res.body;
    return JSON.stringify({
      id: rcs.id,
      recipient: rcs.recipient,
      sender: rcs.sender,
      content_type: rcs.content_type,
      created_at: rcs.created_at,
      message_ref: rcs.message_ref,
      ...(request.warning ? { warning: request.warning } : {}),
    });
  }
}
