// ===============================
// Global File fix (Render / Node 18)
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
// Addon Definition
// ===============================
const builder = new addonBuilder({
  id: "org.einthusan.mediafusion",
  version: "1.1.4", // IMPORTANT: bump version
  name: "Einthusan + MediaFusion",
  description: "TMDB movie catalog with MediaFusion streams",
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
// Stream Handler
// ===============================
builder.defineStreamHandler(async ({ id }) => {
  try {
    const url = `${MEDIAFUSION_BASE}/stream/movie/${encodeURIComponent(id)}.json`;
    const res = await axios.get(url, { timeout: 15000 });
    return res.data;
  } catch {
    return { streams: [] };
  }
});

// ===============================
// Express Server (CORRECT WAY)
// ===============================
const app = express();
const addonInterface = builder.getInterface();

// 🔥 THIS IS THE KEY LINE
app.use((req, res) => addonInterface.serveHTTP(req, res));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log("Addon running on port", PORT);
});
