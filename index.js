'use strict';

// ===============================
// Render / Undici global fix
// MUST be first
// ===============================
if (typeof global.File === "undefined") {
  global.File = class File {};
}

// ===============================
// Imports
// ===============================
const express = require("express");
const axios = require("axios");
const { addonBuilder } = require("stremio-addon-sdk");

// ===============================
// Config
// ===============================
const TMDB_API_KEY = "bc6af38ba37cbc5864165528718b2709";
const MEDIAFUSION_BASE =
  "https://mediafusion.elfhosted.com/D-OXuzfbovxUxyTLs8idsFOdMnvdbRM3wiFf1b6Cp4R7n2NRHl_mS11sFl0axJ5Z7V";

// ===============================
// Addon Builder
// ===============================
const builder = new addonBuilder({
  id: "org.einthusan.mediafusion",
  version: "1.3.0",
  name: "Einthusan + MediaFusion",
  description: "TMDB Movies catalog with MediaFusion streams",

  resources: ["catalog", "meta", "stream"],
  types: ["movie"],

  catalogs: [
    {
      type: "movie",
      id: "tmdb-movies",
      name: "Movies",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }
  ],

  // REQUIRED for Configure button
  behaviorHints: {
    configurable: true,
    configurationRequired: false
  }
});

// ===============================
// Catalog Handler (FIXED)
// ===============================
builder.defineCatalogHandler(async ({ type, id, extra }) => {
  // 🔴 REQUIRED CHECK (this fixes the missing catalog)
  if (type !== "movie" || id !== "tmdb-movies") {
    return { metas: [] };
  }

  const page = Math.floor((extra.skip || 0) / 20) + 1;
  const query = extra.search;

  const url = query
    ? "https://api.themoviedb.org/3/search/movie"
    : "https://api.themoviedb.org/3/movie/popular";

  const res = await axios.get(url, {
    params: {
      api_key: TMDB_API_KEY,
      language: "en-US",
      page,
      query
    }
  });

  return {
    metas: res.data.results.map(m => ({
      id: `tmdb:${m.id}`,
      type: "movie",
      name: m.title,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : null,
      posterShape: "poster"
    }))
  };
});

// ===============================
// Meta Handler
// ===============================
builder.defineMetaHandler(async ({ id }) => {
  const tmdbId = id.split(":")[1];

  const res = await axios.get(
    `https://api.themoviedb.org/3/movie/${tmdbId}`,
    { params: { api_key: TMDB_API_KEY } }
  );

  const m = res.data;

  return {
    meta: {
      id: `tmdb:${m.id}`,
      type: "movie",
      name: m.title,
      description: m.overview,
      releaseInfo: m.release_date,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : null,
      background: m.backdrop_path
        ? `https://image.tmdb.org/t/p/original${m.backdrop_path}`
        : null
    }
  };
});

// ===============================
// Stream Handler (MediaFusion)
// ===============================
builder.defineStreamHandler(async ({ id }) => {
  try {
    const url =
      `${MEDIAFUSION_BASE}/stream/movie/${encodeURIComponent(id)}.json`;

    const res = await axios.get(url, { timeout: 15000 });
    return res.data;
  } catch {
    return { streams: [] };
  }
});

// ===============================
// Express Server
// ===============================
const app = express();
const addonInterface = builder.getInterface();

// Manifest
app.get("/manifest.json", (req, res) => {
  res.json(addonInterface.manifest);
});

// Stremio routes
app.get("/:resource/:type/:id/:extra?.json", async (req, res) => {
  try {
    const result = await addonInterface.get(req.params);
    res.json(result);
  } catch {
    res.json({});
  }
});

// ===============================
// Configure Page (for button)
// ===============================
app.get("/configure", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Einthusan + MediaFusion</title>
  <style>
    body {
      background:#111;
      color:#fff;
      font-family:Arial;
      padding:20px;
    }
    button {
      padding:12px 20px;
      font-size:16px;
      cursor:pointer;
    }
  </style>
</head>
<body>
  <h2>Einthusan + MediaFusion</h2>
  <p>No configuration required.</p>
  <button onclick="install()">Install Addon</button>

  <script>
    function install() {
      window.location.href =
        "stremio://addon-install?url=" +
        encodeURIComponent(window.location.origin + "/manifest.json");
    }
  </script>
</body>
</html>
`);
});

// ===============================
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log("✅ Addon running on port", PORT);
});
