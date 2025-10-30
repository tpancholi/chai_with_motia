// step 5:
// Uses Resend API to send improved titles to the user

export const config = {
  name: "sendEmail",
  type: "event",
  subscribes: ["yt.titles.ready"],
  emits: ["yt.email.send", "yt.email.error"],
};

interface ImprovedTitle {
  originalTitle: string;
  improvedTitle: string;
  rationale: string;
  url: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    const email = data.email;
    const channelName = data.channelName;
    const improvedTitles = data.improvedTitles;

    logger.info("Preparing email content", {
      jobId,
      email,
      titleCount: improvedTitles.length,
    });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not set");
    }
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "sending email",
    });

    const emailText = generateEmailText(channelName, improvedTitles);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: `YouTube Title Doctor - Improved Titles for ${channelName}`,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `RESEND API error: ${errorData.error?.message} || 'Unknown RESEND API error'`,
      );
    }
    const emailResult = await response.json();

    logger.info("Email sent successfully", {
      jobId,
      emailId: emailResult.id,
    });
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "completed",
      emailId: emailResult.id,
      completedAt: new Date().toISOString(),
    });
    await emit({
      topic: "yt.email.send",
      data: {
        jobId,
        email,
        emailId: emailResult.id,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error("Error in email send handler", {
      error: error.message,
    });
    if (!jobId) {
      logger.error("Cannot send error notification - missing jobId", {
        jobId,
      });
      return;
    }
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "error",
      error: error.message,
    });

    await emit({
      topic: "yt.email.error",
      data: {
        jobId,
        error: "Failed to send email.  Please try again later.",
      },
    });
  }
};

function generateEmailText(
  channelName: string,
  titles: ImprovedTitle[],
): string {
  let text = `YouTube Title Doctor - Improved Titles for ${channelName}\n\n`;
  text += `${"=".repeat(50)}\n\n`;

  titles.forEach((title, idx) => {
    text += `Video ${idx + 1}:\n`;
    text += `----------------\n`;
    text += `Original: ${title.originalTitle}\n`;
    text += `Improved: ${title.improvedTitle}\n`;
    text += `Why: ${title.rationale}\n`;
    text += `Watch: ${title.url}\n`;
  });

  text += `${"=".repeat(50)}\n\n`;
  text += `Powered by Deepshield AI`;
  return text;
}
