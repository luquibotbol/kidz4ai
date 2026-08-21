import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Spec 09 §2 carve-out: self-harm and violence flags reach Lucas by email with
 * the category and time only — never the transcript. Spec 09 §3: manual flag
 * reports reach him too.
 *
 * Sends through the Cloudflare Email Sending binding, restricted in
 * wrangler.jsonc to a single `from` address.
 *
 * Unconfigured means log loudly and carry on. Silence here would be the
 * dangerous failure, so it is never swallowed.
 */
export async function notifyParent(subject: string, body: string): Promise<void> {
  let env: CloudflareEnv | null = null;
  try {
    env = (await getCloudflareContext({ async: true })).env;
  } catch {
    // no Workers context (plain node, tests)
  }

  const to = env?.PARENT_EMAIL;
  const from = env?.ALERT_FROM;

  if (!env?.EMAIL || !to || !from) {
    console.error(`[spec09] PARENT NOTIFICATION NOT SENT (email unconfigured)\n${subject}\n${body}`);
    return;
  }

  try {
    await env.EMAIL.send({
      to,
      from: { email: from, name: "Kids4AI" },
      subject,
      text: body,
    });
  } catch (e) {
    // A bounced or rejected alert must still be visible in the Worker logs.
    console.error("[spec09] parent notification failed to send:", e);
  }
}
