// ===============================
// Global fix for Render / Undici
// ===============================
if (typeof global.File === "undefined") {
  global.File = class File {};
}

// ===============================
// Imports
// ===============================
const express = require("express");
const axios = require("axios");
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

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
  version: "1.2.0",
  name: "Einthusan + MediaFusion",
  description: "TMDB movies catalog with MediaFusion streams",
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "tmdb-movies",
      name: "TMDB Movies",
      extra: [
        { name: "search", isRequired: false },
        { name: "skip", isRequired: false }
      ]
    }
  ]
});

// ===============================
// Catalog Handler
// ===============================
builder.defineCatalogHandler(async ({ extra }) => {
  const page = Math.floor((extra.skip || 0) / 20) + 1;
  const query = extra.search;

  const url = query
    ? "https://api.themoviedb.org/3/search/movie"
    : "https://api.themoviedb.org/3/movie/popular";

  const res = await axios.get(url, {
    params: {
      api_key: TMDB_API_KEY,
      page,
      query
    }
  });

  return {
    metas: res.data.results.map((m) => ({
      id: `tmdb:${m.id}`,
      type: "movie",
      name: m.title,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : null
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
// Stream Handler
// ===============================
builder.defineStreamHandler(async ({ id }) => {
  try {
    const res = await axios.get(
      `${MEDIAFUSION_BASE}/stream/movie/${encodeURIComponent(id)}.json`,
      { timeout: 15000 }
    );
    return res.data;
  } catch {
    return { streams: [] };
  }
});

// ===============================
// Express Server
// ===============================
const app = express();

// 🔥 THIS LINE FIXES EVERYTHING
serveHTTP(builder.getInterface(), { app });

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log("Stremio addon running on port", PORT);
});
