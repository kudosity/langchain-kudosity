import { StructuredTool } from "@langchain/core/tools";
import type { z } from "zod";

export const PACKAGE_VERSION = "0.2.0";

export interface KudosityToolFields {
  /**
   * Kudosity V2 API key (`x-api-key`). Falls back to the
   * `KUDOSITY_API_KEY` environment variable.
   */
  apiKey?: string;
  /**
   * Default sender used when the model does not supply one per send.
   * For SMS/MMS: a virtual number assigned to your account, or an
   * alphanumeric sender ID (max 11 chars). For RCS: a registered RCS
   * agent ID (never a phone number).
   */
  defaultSender?: string;
  /** Override the API base URL. Defaults to Kudosity production. */
  baseUrl?: string;
}

/**
 * Shared plumbing for Kudosity V2 tools: auth, User-Agent attribution tag,
 * envelope normalization (SMS/MMS respond flat; RCS wraps in `data`), and
 * RFC 9457 error surfacing as structured JSON the model can read.
 */
export abstract class KudosityTool<
  T extends z.ZodObject<z.ZodRawShape>
> extends StructuredTool<T> {
  protected apiKey: string;

  protected defaultSender?: string;

  protected baseUrl: string;

  constructor(fields: KudosityToolFields = {}) {
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

  /**
   * POST a JSON payload to a V2 path. Returns the response body with any
   * `data` envelope unwrapped, or a structured error object on non-2xx.
   */
  protected async post(
    path: string,
    payload: Record<string, unknown>
  ): Promise<
    | { ok: true; body: Record<string, unknown> }
    | { ok: false; error: Record<string, unknown> }
  > {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
        "User-Agent": `langchain-kudosity/${PACKAGE_VERSION}`,
      },
      body: JSON.stringify(payload),
    });

    const body = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    if (!res.ok) {
      // Kudosity errors follow RFC 9457 Problem Details under an `error`
      // key; `error.issues[]` lists every failed field at once.
      return {
        ok: false,
        error: {
          error: `Kudosity API error (HTTP ${res.status})`,
          detail: body.error ?? body,
        },
      };
    }

    return {
      ok: true,
      body: ((body as { data?: unknown }).data ?? body) as Record<
        string,
        unknown
      >,
    };
  }

  protected missingSenderError(what: string): string {
    return JSON.stringify({
      error: `No ${what} provided. Supply \`sender\` in the tool input, or configure \`defaultSender\` on the tool.`,
    });
  }
}
