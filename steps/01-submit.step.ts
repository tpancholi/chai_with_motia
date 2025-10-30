import type { ApiRouteConfig } from "motia";
import { nanoid } from "nanoid";

// Step 1:
// Accept channel name and email from the user to start the workflow

export const config: ApiRouteConfig = {
  name: "SubmitChannel",
  type: "api",
  path: "/submit",
  method: "POST",
  emits: ["yt.submit"],
};

interface SubmitRequest {
  channel: string;
  email: string;
}

export const handler = async (req: any, { emit, logger, state }: any) => {
  try {
    logger.info("Received submission request", { body: req.body });
    const { channel, email } = req.body as SubmitRequest;
    if (!channel || !email) {
      return {
        status: 400,
        body: {
          error: "Channel and email are required",
        },
      };
    }
    //validate email
    const emailRegex =
      /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;
    if (!emailRegex.test(email)) {
      return {
        status: 400,
        body: {
          error: "Invalid email format",
        },
      };
    }

    const jobId = `job_${nanoid()}`;
    await state.set(`job:${jobId}`, {
      jobId,
      channel,
      email,
      status: "queued",
      createdAt: new Date().toISOString(),
    });
    logger.info("Job created successfully", { jobId, channel, email });
    await emit({
      topic: "yt.submit",
      data: {
        jobId,
        channel,
        email,
      },
    });
    return {
      status: 202,
      body: {
        success: true,
        jobId,
        message:
          "Your request has been submitted. You will receive an email soon with the improvement suggestion for your youtube videos",
      },
    };
  } catch (error: any) {
    logger.error("Error in submission handler", { error: error.message });
    return {
      status: 500,
      body: {
        error: "Internal Server Error",
      },
    };
  }
};
