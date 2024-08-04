/**
 * fetch youtube.com video's webpage HTML for embedded transcript
 * if blocked, use scraper of youtubetranscript.com
 * @param {string} videoUrl
 * @param {boolean} boolTimestamps - true to return timestamps, default true
 * @return {Object} {content, timestamps} where content is the full text of
 * the transcript, and timestamps is an array of [characterIndex, timeSeconds]
 */
export async function extractYoutubeText(videoUrl, boolTimestamps = true) {
  try {
    var transcript = await fetchTranscript(videoUrl);
  } catch (e) {
    console.log(e.message);
    transcript = await fetchViaYoutubeTranscript(videoUrl);
  }

  var content = "";
  var timestamps = [];
  transcript.forEach(({ offset, text }) => {
    if (boolTimestamps) timestamps.push([content.length, Math.floor(offset, 0)]);

    content += text + " ";
  });

  if (!boolTimestamps) return { content };

  content = content
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');

  var word_count = content.split(" ").length;
  return { content, timestamps, word_count, format: "video" };
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.83 Safari/537.36,gzip(gfe)";
const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
const RE_XML_TRANSCRIPT = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;

function YouTubeTranscriptError(message) {
  return new Error(`🚨 ${message}`);
}

async function fetchTranscript(videoId, config = {}) {
  const identifier = getURLYoutubeVideo(videoId);
  const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${identifier}`, {
    headers: {
      ...(config.lang && { "Accept-Language": config.lang }),
      "User-Agent": USER_AGENT
    }
  });
  const videoPageBody = await videoPageResponse.text();

  if (videoPageBody.includes('class="g-recaptcha"')) {
    throw YouTubeTranscriptError("Too many requests. YouTube requires solving a captcha.");
  }

  if (!videoPageBody.includes('"playabilityStatus":')) {
    throw YouTubeTranscriptError(`The video is no longer available (${videoId})`);
  }

  const [, captionsJson] = videoPageBody.split('"captions":');
  if (!captionsJson) {
    throw YouTubeTranscriptError(`Transcript is disabled on this video (${videoId})`);
  }

  const captions = JSON.parse(captionsJson.split(',"videoDetails')[0].replace("\n", ""))?.playerCaptionsTracklistRenderer;
  if (!captions?.captionTracks) {
    throw YouTubeTranscriptError(`No transcripts are available for this video (${videoId})`);
  }

  const track = config.lang ? captions.captionTracks.find((track) => track.languageCode === config.lang) : captions.captionTracks[0];

  if (!track) {
    throw YouTubeTranscriptError(
      `No transcripts are available in ${config.lang} for this video (${videoId}). Available languages: ${captions.captionTracks.map((t) => t.languageCode).join(", ")}`
    );
  }

  const transcriptResponse = await fetch(track.baseUrl, {
    headers: {
      ...(config.lang && { "Accept-Language": config.lang }),
      "User-Agent": USER_AGENT
    }
  });

  if (!transcriptResponse.ok) {
    throw YouTubeTranscriptError(`Failed to fetch transcript for video (${videoId})`);
  }

  const transcriptBody = await transcriptResponse.text();
  const results = [...transcriptBody.matchAll(RE_XML_TRANSCRIPT)];

  return results.map(([, start, duration, text]) => ({
    text,
    duration: parseFloat(duration),
    offset: parseFloat(start),
    lang: track.languageCode
  }));
}

/**
 * Get YouTube transcript of most YouTube videos,
 * except if disabled by uploader
 * fetch-based scraper of youtubetranscript.com
 *
 * @param {string} videoUrl
 * @return {Object} {content, timestamps} where content is the full text of
 * the transcript, and timestamps is an array of [characterIndex, timeSeconds]
 */
export async function fetchViaYoutubeTranscript(videoUrl) {
  const videoId = getURLYoutubeVideo(videoUrl);
  const url = "https://youtubetranscript.com/?server_vid2=" + videoId;

  const response = await fetch(url);
  const html = await response.text();

  const transcriptRegex = /<text data-start="([\d.]+)".*?>(.*?)<\/text>/g;
  const matches = [...html.matchAll(transcriptRegex)];

  const transcript = matches.map((match) => ({
    text: decodeHTMLEntities(match[2]),
    offset: parseFloat(match[1])
  }));

  const content = transcript.map((item) => item.text).join(" ");
  const timestamps = [];
  let charIndex = 0;

  transcript.forEach((item) => {
    timestamps.push([charIndex, item.offset]);
    charIndex += item.text.length + 1; // +1 for the space we added
  });

  return { content, timestamps };
}

// Helper function to decode HTML entities
function decodeHTMLEntities(text) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

// Assuming getURLYoutubeVideo function is defined elsewhere
// function getURLYoutubeVideo(url) { ... }

/**
 * Test if URL is to youtube video and return video id if true
 * @param {string} url - youtube video URL
 * @return {string|boolean} video ID or false
 */
export function getURLYoutubeVideo(url) {
  var match = url?.match(
    /(?:\/embed\/|v=|v\/|vi\/|youtu\.be\/|\/v\/|^https?:\/\/(?:www\.)?youtube\.com\/(?:(?:watch)?\?.*v=|(?:embed|v|vi|user)\/))([^#\&\?]*).*/
  );
  return match ? match[1] : false;
}