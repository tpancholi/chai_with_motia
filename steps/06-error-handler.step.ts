// step 6:
// listens to error events and sends an email to the user

export const config = {
  name: "sendEmail",
  type: "event",
  subscribes: [
    "yt.channel.error",
    "yt.videos.error",
    "yt.titles.error",
    "yt.email.error",
  ],
  emits: ["yt.error.notified"],
};

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  try {
    const data = eventData || {};
    const jobId = data.jobId;
    const email = data.email;
    const error = data.error;
    const channelName = data.channelName;

    logger.info("Preparing to notify error", {
      jobId,
      email,
      error,
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

    const emailText = `we are facing some issue in generating 
    better titles for your channel ${channelName}.`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: RESEND_FROM_EMAIL,
        to: [email],
        subject: `YouTube Title Doctor - Request failed for ${channelName}`,
        text: emailText,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `RESEND API error: ${errorData.message} || 'Unknown RESEND API error'`,
      );
    }
    const emailResult = await response.json();

    logger.info("Error Email sent successfully", {
      jobId,
      emailId: emailResult.id,
    });

    await emit({
      topic: "yt.error.notified",
      data: {
        jobId,
        email,
        emailId: emailResult.id,
        completedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error("Error in email notification handler", {
      error: error.message,
    });
  }
};
