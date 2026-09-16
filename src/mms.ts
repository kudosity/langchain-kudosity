import { z } from "zod";
import { KudosityTool, type KudosityToolFields } from "./base.js";

export type KudositySendMmsFields = KudosityToolFields;

const schema = z.object({
  recipient: z
    .string()
    .describe(
      "Destination phone number, local or E.164 international format, e.g. 61491570156"
    ),
  content_urls: z
    .array(z.string())
    .min(1)
    .describe(
      "Publicly reachable URLs of the media to attach — JPEG/PNG/GIF/BMP images, MP3/WAV audio, or video. Images up to ~400 KB."
    ),
  message: z
    .string()
    .max(1000)
    .optional()
    .describe("Body text, max 1,000 characters."),
  subject: z
    .string()
    .max(20)
    .optional()
    .describe("Message subject — max 20 characters, ASCII only."),
  sender: z
    .string()
    .optional()
    .describe(
      "Sender: a virtual number assigned to the Kudosity account. Omit to use the tool's configured default sender."
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
 * LangChain tool that sends an MMS (image, GIF, video or audio attachment)
 * through the Kudosity platform (POST https://api.transmitmessage.com/v2/mms).
 */
export class KudositySendMms extends KudosityTool<typeof schema> {
  static lc_name() {
    return "KudositySendMms";
  }

  name = "kudosity_send_mms";

  description =
    "Send an MMS (multimedia message) with an image, GIF, video or audio attachment " +
    "to a phone number via the Kudosity messaging platform. Media is passed as public URLs. " +
    "Returns the message id (for matching delivery webhooks) and submission status as JSON — " +
    "a 'pending' status is normal; real delivery outcomes arrive via webhooks.";

  schema = schema;

  protected async _call(input: z.infer<typeof schema>): Promise<string> {
    const sender = input.sender ?? this.defaultSender;
    if (!sender) return this.missingSenderError("sender");

    const res = await this.post("/v2/mms", {
      recipient: input.recipient,
      content_urls: input.content_urls,
      sender,
      ...(input.message ? { message: input.message } : {}),
      ...(input.subject ? { subject: input.subject } : {}),
      ...(input.message_ref ? { message_ref: input.message_ref } : {}),
    });
    if (!res.ok) return JSON.stringify(res.error);

    const mms = res.body;
    return JSON.stringify({
      id: mms.id,
      status: mms.status,
      recipient: mms.recipient,
      sender: mms.sender,
      content_urls: mms.content_urls,
      message_ref: mms.message_ref,
    });
  }
}
