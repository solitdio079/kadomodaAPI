import { BrevoClient } from "@getbrevo/brevo";
import "dotenv/config";

if (!process.env.BREVO_API_KEY) throw new Error("No API KEY FOR BREVO");
const brevo = new BrevoClient({ apiKey: process.env.BREVO_API_KEY });

async function sendEmail(
  subject: string,
  htmlContent: string,
  sender: { name: string; email: string },
  to: Array<{ email: string; name: string }>,
) {
  const result = await brevo.transactionalEmails.sendTransacEmail({
    subject,
    htmlContent,
    sender,
    to,
  });
  return result;
}

export default sendEmail;
