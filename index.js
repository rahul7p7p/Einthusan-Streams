// ===============================
// Render / Undici global fix
// ===============================
if (typeof global.File === "undefined") {
  global.File = class File {};
}

// ===============================
const express = require("express");
const axios = require("axios");
const { addonBuilder } = require("stremio-addon-sdk");

// ===============================
const TMDB_API_KEY = "bc6af38ba37cbc5864165528718b2709";
const DEFAULT_MEDIAFUSION_TOKEN =
  "D-OXuzfbovxUxyTLs8idsFOdMnvdbRM3wiFf1b6Cp4R7n2NRHl_mS11sFl0axJ5Z7V";

// ===============================
// ADDON MANIFEST (CONFIG ENABLED)
// ===============================
const builder = new addonBuilder({
  id: "org.einthusan.mediafusion",
  version: "1.2.0",
  name: "Einthusan + MediaFusion",
  description: "Movies with configurable MediaFusion streams",
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  behaviorHints: {
    configurable: true
  },
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
// CONFIGURE PAGE
// ===============================
const app = express();

app.get("/configure", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>MediaFusion Configuration</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    input { width: 100%; padding: 8px; margin: 10px 0; }
    button { padding: 10px; width: 100%; }
  </style>
</head>
<body>
  <h2>MediaFusion Settings</h2>

  <label>MediaFusion Token</label>
  <input id="token" placeholder="Paste your MediaFusion token" />

  <button onclick="save()">Save</button>

<script>
function save() {
  const token = document.getElementById("token").value;
  const params = new URLSearchParams({ token });
  window.location = "stremio-addon://" + params.toString();
}
</script>
</body>
</html>
`);
});

// ===============================
// CATALOG (TMDB)
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
// STREAM (CONFIGURABLE MEDIAFUSION)
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
// ADDON INTERFACE (IMPORTANT)
// ===============================
app.use("/addon", builder.getInterface());

// Optional homepage
app.get("/", (_, res) => res.send("Stremio addon running"));

// ===============================
const PORT = process.env.PORT || 7000;
app.listen(PORT, () =>
  console.log("Addon running on port", PORT)
);
