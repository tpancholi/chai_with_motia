// step 4:
// Uses OpenAI GPT or Google Gemini to generate improved titles

export const config = {
  name: "generateTitles",
  type: "event",
  subscribes: ["yt.videos.fetched"],
  emits: ["yt.titles.ready", "yt.titles.error"],
};

interface ImprovedTitle {
  originalTitle: string;
  improvedTitle: string;
  rationale: string;
  url: string;
}

export const handler = async (eventData: any, { emit, logger, state }: any) => {
  let jobId: string | undefined;
  let email: string | undefined;
  let channelName: string | undefined;

  try {
    const data = eventData || {};
    jobId = data.jobId;
    email = data.email;
    channelName = data.channelName;
    const videos = data.videos;

    logger.info("Starting to optimize video titles", {
      jobId,
      videoCount: videos?.length,
    });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not set");
    }
    const jobData = await state.get(`job:${jobId}`);
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "generating optimized titles",
    });

    const videoTitles = videos
      .map(
        (v: any, idx: number) => `$
    idx + 1;
    . "${v.title}"`,
      )
      .join("\n");

    const userPrompt = `You are a YouTube title optimization expert.  
    Below are ${videos.length} video titles from the channel "${channelName}".  
    For each title, provide:
    1. An improved version that is more engaging, SEO-friendly, and likely to get more clicks
    2. A brief rationale (one or two sentences) explaining why you think the improved version is better
    
    Guidelines:
    - Keep the core topic and authenticity
    - Use action verbs, numbers, and specific value propositions
    - Make it curiosity-inducing without being clickbait
    - Optimize for searchability and clarity
    
    Video titles:
    ${videoTitles}
    
    Respond in JSON format:
{
  "titles": [
    {
      "original": "...",
      "improved": "...",
      "rationale": "..."
    }
  ]
}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a youtube SEO and engagement expert who helps creators write better video titles",
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
        temperature: 0.7,
        response_format: { type: "json_object" },
        max_tokens: 1000,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `Openai API error: ${errorData.error?.message} || 'Unknown OpenAI API error'`,
      );
    }
    const aiResponse = await response.json();
    const aiContent = aiResponse.choices[0].message.content;

    const parsedResponse = JSON.parse(aiContent);
    const improvedTitles: ImprovedTitle[] = parsedResponse.titles.map(
      (title: any, idx: number) => ({
        originalTitle: title.original,
        improvedTitle: title.improved,
        rationale: title.rationale,
        url: videos[idx].url,
      }),
    );

    logger.info("Optimised video title generated successfully", {
      jobId,
      channelName,
      videoCount: improvedTitles.length,
    });
    await state.set(`job:${jobId}`, {
      ...jobData,
      status: "optimized titles generated",
      improvedTitles,
    });
    await emit({
      topic: "yt.titles.ready",
      data: {
        jobId,
        email,
        channelName,
        improvedTitles,
      },
    });
  } catch (error: any) {
    logger.error("Error in generate titles handler", {
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
      topic: "yt.titles.error",
      data: {
        jobId,
        email,
        channelName,
        error:
          "Failed to generate improved titles for videos.  Please try again later.",
      },
    });
  }
};
