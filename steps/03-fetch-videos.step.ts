import type { EventConfig } from "motia";

// step 3:
// Download latest five videos from youtube channel ID

export const config: EventConfig = {
  name: "fetchVideos",
  type: "event",
  subscribes: ["yt.channel.resolved"],
  emits: ["yt.videos.fetched", "yt.videos.error"],
};

interface Video {
  videoId: string;
  title: string;
  url: string;
  publishedAt: string;
  description: string;
  thumbnail: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;
  let channelName: string | undefined;
  let channelId: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    channelName = data.channelName;
    channelId = data.channelId;

    logger.info("Starting video download", { jobId, channelName });

    const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
    if (!YOUTUBE_API_KEY) {
      throw new Error("YOUTUBE_API_KEY is not set");
    }
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "downloading videos",
    });
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&channelId=${channelId}&maxResults=5&key=${YOUTUBE_API_KEY}`;

    const response = await fetch(searchUrl);
    const youtubeData = await response.json();
    if (!youtubeData.items || youtubeData.items.length === 0) {
      logger.warn("No videos found for channel", { jobId, channelName });
      await state.set(`job:${jobId}`, {
        ...jobData,
        status: "failed",
        error: "No videos found",
      });
      await emit({
        topic: "yt.videos.error",
        data: {
          jobId,
          email,
          error: "No videos found for this channel",
        },
      });
      return;
    }
    const videos: Video[] = youtubeData.items.map((item: any) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      publishedAt: item.snippet.publishedAt,
      description: item.snippet.description,
      thumbnail: item.snippet.thumbnails.high.url,
    }));
    logger.info("Videos fetched successfully", {
      jobId,
      channelName,
      videoCount: videos.length,
    });
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "videos fetched",
      videos,
    });
    await emit({
      topic: "yt.videos.fetched",
      data: {
        jobId,
        email,
        channelName,
        videos,
      },
    });
  } catch (error: any) {
    logger.error("Error in fetching videos handler", {
      error: error.message,
    });
    if (!jobId || !email) {
      logger.error("Cannot send error notification - missing jobId or email", {
        jobId,
        email,
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
      topic: "yt.videos.error",
      data: {
        jobId,
        email,
        channelName,
        error: "Failed to fetch videos.  Please try again.",
      },
    });
  }
};
