import express from "express";
import path from "path";
import fetch from "node-fetch";

const app = express();

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
  }
  next();
});

app.use(express.json());
app.use(express.static(path.resolve("dist")));

// Serve built front-end in production
app.use(express.static(path.resolve("dist")));

// Booru JSON proxy supporting multiple sites with detailed debug output
// Booru JSON proxy supporting gelbooru, rule34, realbooru
app.get("/api/booru", async (req, res) => {
  const { tags = "", blacklist = "", site = "gelbooru", limit = "50" } = req.query;
  const siteParam = site.toLowerCase();
  const maxItems = parseInt(limit, 10) || 50;

  // Helper to set CORS & error
  function sendError(msg, code = 404) {
    res.status(code).set("Access-Control-Allow-Origin", "*").json({ error: msg });
  }

  // REALBOORU SCRAPER (with view-page fetch for videos)
if (siteParam === "realbooru") {
  const listUrl = `https://realbooru.com/index.php?page=post&s=list&tags=${encodeURIComponent(
    tags + " " + blacklist
  )}`;
  console.log(`Scraping Realbooru list: ${listUrl}`);

  let listHtml;
  try {
    const resp = await fetch(listUrl);
    listHtml = await resp.text();
  } catch (e) {
    console.error("Realbooru list fetch failed:", e);
    return sendError("Failed to scrape Realbooru list", 502);
  }

  // First, gather all post IDs on the page
  const idRegex = /<a\s+id="p(\d+)"/g;
  const postIds = [];
  let m;
  while ((m = idRegex.exec(listHtml)) !== null && postIds.length < maxItems) {
    postIds.push(m[1]);
  }

  const posts = [];

  // Now fetch each post page to get the real media URL
  for (let id of postIds) {
    if (posts.length >= maxItems) break;
    const viewUrl = `https://realbooru.com/index.php?page=post&s=view&id=${id}`;
    let viewHtml;
    try {
      const vresp = await fetch(viewUrl);
      viewHtml = await vresp.text();
    } catch (e) {
      console.warn(`Failed to load Realbooru post ${id}:`, e);
      continue;
    }

    // Look for video source first
    const vidMatch = /<source[^>]+src="([^"]+\.(?:mp4|webm))"/i.exec(viewHtml);
    if (vidMatch) {
      // Clean up any double-slashes
      const raw = vidMatch[1].replace(/realbooru\.com\/\//, "realbooru.com/");
      const proxied = `/api/video?url=${encodeURIComponent(raw)}`;
      posts.push({ file_url: proxied, type: "video" });
      continue;
    }

    // Otherwise find the full-res image
    // Realbooru view pages use <img id="image" src="https://realbooru.com/images/...">
    const imgMatch = /<img[^>]+id="image"[^>]+src="([^"]+)"/i.exec(viewHtml)
                  || /<img[^>]+src="([^"]+\/images\/[^"]+\.(?:jpg|jpeg|png))"/i.exec(viewHtml);

    if (imgMatch) {
      posts.push({ file_url: imgMatch[1], type: "image" });
    }
  }

  console.log(`Realbooru: found ${posts.length} items out of ${postIds.length} IDs`);
  if (posts.length === 0) {
    return sendError("No media found for those tags/site");
  }

  return res
    .set("Access-Control-Allow-Origin", "*")
    .json({ posts, site: siteParam, count: posts.length });
}

  // RULE34 or GELBOORU via JSON API
  let apiUrl;
  if (siteParam === "rule34") {
    apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(
      tags + " " + blacklist
    )}`;
  } else {
    // default to Gelbooru
    apiUrl = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(
      tags + " " + blacklist
    )}`;
  }

  console.log(`Proxying ${siteParam} API URL: ${apiUrl}`);
  try {
    const apiResp = await fetch(apiUrl);
    const data = await apiResp.json();
    let posts = Array.isArray(data)
      ? data
      : data.posts || data.post || [];
    // Normalize to [{file_url}, ...] and limit
    posts = posts
      .map((p) => ({ file_url: p.file_url }))
      .slice(0, maxItems);

    if (posts.length === 0) {
      return sendError("No media found for those tags/site");
    }
    return res
      .set("Access-Control-Allow-Origin", "*")
      .json({ posts, site: siteParam, count: posts.length });
  } catch (err) {
    console.error(`${siteParam} API proxy error:`, err);
    return sendError("Bad gateway", 502);
  }
});

app.get('/api/eleven/voices', async (req, res) => {
  const apiKey = req.query.apiKey;
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing ElevenLabs API key' });
  }
  try {
    const elevenRes = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey }
    });
    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error('ElevenLabs voices error:', elevenRes.status, errText);
      return res.status(502).json({ error: 'Failed to fetch voices' });
    }
    const data = await elevenRes.json();
    // data.voices is an array of { voice_id, name, category, ... }
    res
      .set('Access-Control-Allow-Origin', '*')
      .json({ voices: data.voices });
  } catch (err) {
    console.error('ElevenLabs voices proxy error:', err);
    res.status(502).json({ error: 'TTS voices proxy failed' });
  }
});

app.post('/api/eleven', async (req, res) => {
  const { text, voiceId, apiKey, modelId = 'eleven_turbo_v2_5' } = req.body;
  if (!apiKey) {
    return res.status(400).json({ error: 'Missing ElevenLabs API key' });
  }
  if (!text) {
    return res.status(400).json({ error: 'Missing text to speak' });
  }
  // default voiceId if not provided
  const vid = voiceId || '21m00Tcm4TlvDq8ikWAM';
  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${vid}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
		  model_id: modelId,
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.75
          }
        })
      }
    );
    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error('ElevenLabs error:', elevenRes.status, errText);
      return res.status(502).json({ error: 'TTS service error' });
    }
    res.set('Content-Type', 'audio/mpeg');
    elevenRes.body.pipe(res);
  } catch (err) {
    console.error('ElevenLabs proxy error:', err);
    res.status(502).json({ error: 'TTS proxy failed' });
  }
});


// Video proxy (bypass CORS)
app.get('/api/video', async (req, res) => {
  const videoUrl = req.query.url;
  try {
    const vidRes = await fetch(videoUrl);
    res.set('Access-Control-Allow-Origin', '*');
    res.type(vidRes.headers.get('content-type') || 'video/mp4');
    vidRes.body.pipe(res);
  } catch (err) {
    console.error('Video proxy error:', err);
    res.status(502).end();
  }
});

// Fallback for SPA routing
app.use((req, res) => {
  res.sendFile(path.resolve('dist/index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Proxy server running on http://localhost:${PORT}`));
