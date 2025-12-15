// ===============================
// Render undici fix
// ===============================
if (typeof global.File === "undefined") {
  global.File = class File {};
}

const express = require("express");
const axios = require("axios");
const { addonBuilder } = require("stremio-addon-sdk");

const TMDB_API_KEY = "bc6af38ba37cbc5864165528718b2709";
const DEFAULT_MEDIAFUSION_TOKEN =
  "D-OXuzfbovxUxyTLs8idsFOdMnvdbRM3wiFf1b6Cp4R7n2NRHl_mS11sFl0axJ5Z7V";

// ===============================
// ADDON
// ===============================
const builder = new addonBuilder({
  id: "org.einthusan.mediafusion",
  version: "1.3.0",
  name: "Einthusan + MediaFusion",
  description: "Movies catalog with configurable MediaFusion streams",
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],

  // ✅ THIS enables Configure button
  config: [
    {
      key: "token",
      type: "text",
      title: "MediaFusion Token",
      default: DEFAULT_MEDIAFUSION_TOKEN
    }
  ],

  catalogs: [
    {
      type: "movie",
      id: "tmdb-movies",
      name: "Movies",
      extra: [{ name: "search" }, { name: "skip" }]
    }
  ]
});

// ===============================
// CATALOG
// ===============================
builder.defineCatalogHandler(async ({ extra }) => {
  const page = Math.floor((extra.skip || 0) / 20) + 1;
  const url = extra.search
    ? "https://api.themoviedb.org/3/search/movie"
    : "https://api.themoviedb.org/3/movie/popular";

  const res = await axios.get(url, {
    params: {
      api_key: TMDB_API_KEY,
      page,
      query: extra.search
    }
  });

  return {
    metas: res.data.results.map(m => ({
      id: "tmdb:" + m.id,
      type: "movie",
      name: m.title,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : null
    }))
  };
});

// ===============================
// META
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
      id,
      type: "movie",
      name: m.title,
      description: m.overview,
      poster: m.poster_path
        ? `https://image.tmdb.org/t/p/w500${m.poster_path}`
        : null
    }
  };
});

// ===============================
// STREAM (CONFIG USED HERE)
// ===============================
builder.defineStreamHandler(async ({ id, config }) => {
  const token = config.token || DEFAULT_MEDIAFUSION_TOKEN;
  const url = `https://mediafusion.elfhosted.com/${token}/stream/movie/${id}.json`;

  try {
    const res = await axios.get(url);
    return res.data;
  } catch {
    return { streams: [] };
  }
});

// ===============================
// SERVER
// ===============================
const app = express();
app.use("/addon", builder.getInterface());

app.get("/", (_, res) => res.send("Addon running"));

const PORT = process.env.PORT || 7000;
app.listen(PORT, () =>
  console.log("Addon running on port", PORT)
);
