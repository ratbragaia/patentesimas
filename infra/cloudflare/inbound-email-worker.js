/**
 * Cloudflare Email Worker: receives mail routed by Email Routing (e.g. support@patentsonar.com) and
 * forwards the raw MIME to the PatentSonar VPS webhook. Deployed by infra/cloudflare/deploy-worker.sh.
 * Bindings (secrets): INBOUND_WEBHOOK_SECRET. Vars: WEBHOOK_URL.
 * On any failure the message is rejected with a temporary error so the sender's MTA retries.
 */
export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).arrayBuffer();
    if (raw.byteLength > 5_000_000) { message.setReject("Message too large"); return; }
    const res = await fetch(env.WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.INBOUND_WEBHOOK_SECRET}`,
        "Content-Type": "message/rfc822",
        "X-Envelope-From": message.from,
        "X-Envelope-To": message.to,
      },
      body: raw,
    });
    if (!res.ok && res.status !== 409) {
      // 4xx/5xx other than duplicate: ask the sending MTA to retry later rather than losing the mail.
      throw new Error(`webhook returned ${res.status}`);
    }
  },
};
