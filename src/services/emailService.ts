import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS =
  process.env.NODE_ENV === 'production'
    ? 'no-reply@writenest.net'
    : 'onboarding@resend.dev';

export const sendVerificationEmail = async (to: string, rawToken: string): Promise<void> => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${rawToken}`;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Verify your Write Nest account',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Verify your email address</h2>
        <p style="color: #444; line-height: 1.5;">
          Thanks for signing up for Write Nest! Click the button below to verify your email address.
          This link expires in <strong>24 hours</strong>.
        </p>
        <a
          href="${verificationUrl}"
          style="display: inline-block; margin: 24px 0; padding: 12px 24px; background-color: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;"
        >
          Verify Email
        </a>
        <p style="color: #888; font-size: 13px;">
          If you did not create an account, you can safely ignore this email.
        </p>
        <p style="color: #bbb; font-size: 12px; margin-top: 32px;">
          Or copy this link into your browser:<br/>
          <span style="word-break: break-all;">${verificationUrl}</span>
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Failed to send verification email: ${error.message}`);
  }
};
