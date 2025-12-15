const { addonBuilder } = require("stremio-addon-sdk");
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

/* ================= APP ================= */

const app = express();
const PORT = process.env.PORT || 7000;

/* ================= CONFIG ================= */

const TMDB_KEY = "bc6af38ba37cbc5864165528718b2709";

// fallback token (used only if user does not configure)
const DEFAULT_MEDIAFUSION_TOKEN =
  "D-OXuzfbovxUxyTLs8idsFOdMnvdbRM3wiFf1b6Cp4R7n2NRHl_mS11sFl0axJ5Z7V";

const LANGUAGES = {
  tamil: "Tamil",
  telugu: "Telugu",
  malayalam: "Malayalam",
  hindi: "Hindi",
  kannada: "Kannada"
};

/* ================= CACHE ================= */

const cache = new Map();

function getCache(key) {
  const data = cache.get(key);
  if (!data) return null;
  if (Date.now() > data.expiry) {
    cache.delete(key);
    return null;
  }
  return data.value;
}

function setCache(key, value, ttl) {
  cache.set(key, { value, expiry: Date.now() + ttl });
}

/* ================= EINTHUSAN SCRAPER ================= */

async function scrapeEinthusanMovies(lang, limit = 25) {
  const cacheKey = `einthusan:${lang}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const url = `https://einthusan.tv/movie/results/?lang=${lang}`;

  const res = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120",
      Referer: "https://einthusan.tv/"
    },
    timeout: 15000
  });

  const $ = cheerio.load(res.data);
  const movies = [];

  $(".block2").each((_, el) => {
    if (movies.length >= limit) return false;

    const title = $(el).find(".title").text().trim();
    const yearText = $(el).find(".year").text().trim();
    const year = parseInt(yearText) || null;

    const style = $(el).find(".block2-img").attr("style") || "";
    const posterMatch = style.match(/url\(['"]?(.*?)['"]?\)/);
    const poster = posterMatch ? posterMatch[1] : null;

    if (title) movies.push({ title, year, poster });
  });

  setCache(cacheKey, movies, 1000 * 60 * 60 * 6); // 6 hours
  return movies;
}

/* ================= TMDB → IMDB ================= */

async function getImdbId(title, year) {
  const cacheKey = `imdb:${title}:${year}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  let search = await axios.get(
    "https://api.themoviedb.org/3/search/movie",
    {
      params: {
        api_key: TMDB_KEY,
        query: title,
        year,
        region: "IN"
      }
    }
  );

  if (!search.data.results.length) {
    search = await axios.get(
      "https://api.themoviedb.org/3/search/movie",
      {
        params: {
          api_key: TMDB_KEY,
          query: title,
          region: "IN"
        }
      }
    );
  }

  if (!search.data.results.length) return null;

  const tmdbId = search.data.results[0].id;

  const details = await axios.get(
    `https://api.themoviedb.org/3/movie/${tmdbId}`,
    { params: { api_key: TMDB_KEY } }
  );

  const imdb = details.data.imdb_id || null;
  setCache(cacheKey, imdb, 1000 * 60 * 60 * 24 * 30); // 30 days
  return imdb;
}

/* ================= STREMIO MANIFEST ================= */

const manifest = {
  id: "org.einthusan.mediafusion",
  version: "1.1.0",
  name: "Einthusan + MediaFusion",
  description: "Einthusan catalog with configurable MediaFusion streams",
  resources: ["catalog", "meta", "stream"],
  types: ["movie"],
  behaviorHints: {
    configurable: true
  },
  catalogs: Object.keys(LANGUAGES).map(lang => ({
    type: "movie",
    id: `einthusan_${lang}`,
    name: `Einthusan ${LANGUAGES[lang]}`
  }))
};

const builder = new addonBuilder(manifest);

/* ================= CONFIGURE PAGE ================= */

app.get("/configure", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>MediaFusion Configuration</title>
  <style>
    body { font-family: Arial; padding: 20px; }
    input, select { width: 100%; padding: 8px; margin: 8px 0; }
    button { padding: 10px; width: 100%; }
  </style>
</head>
<body>
  <h2>MediaFusion Settings</h2>

  <label>MediaFusion Token</label>
  <input name="token" placeholder="Paste your MediaFusion token" />

  <label>Preferred Quality</label>
  <select name="quality">
    <option value="">Any</option>
    <option value="2160p">4K</option>
    <option value="1080p">1080p</option>
    <option value="720p">720p</option>
  </select>

  <button onclick="save()">Save</button>

<script>
function save() {
  const token = document.querySelector('[name="token"]').value;
  const quality = document.querySelector('[name="quality"]').value;

  const params = new URLSearchParams({ token, quality });
  window.location = 'stremio-addon://' + params.toString();
}
</script>
</body>
</html>
`);
});

/* ================= CATALOG ================= */

builder.defineCatalogHandler(async ({ id }) => {
  const lang = id.replace("einthusan_", "");
  const cacheKey = `catalog:${lang}`;

  const cached = getCache(cacheKey);
  if (cached) return cached;

  const movies = await scrapeEinthusanMovies(lang);
  const metas = [];

  for (const movie of movies) {
    const imdb = await getImdbId(movie.title, movie.year);
    if (!imdb) continue;

    metas.push({
      id: imdb,
      type: "movie",
      name: movie.title,
      poster: movie.poster
    });
  }

  const result = { metas };
  setCache(cacheKey, result, 1000 * 60 * 60); // 1 hour
  return result;
});

/* ================= META ================= */

builder.defineMetaHandler(async ({ id }) => {
  const cacheKey = `meta:${id}`;
  const cached = getCache(cacheKey);
  if (cached) return cached;

  const res = await axios.get(
    `https://api.themoviedb.org/3/find/${id}`,
    {
      params: {
        api_key: TMDB_KEY,
        external_source: "imdb_id"
      }
    }
  );

  const movie = res.data.movie_results[0];
  if (!movie) return null;

  const meta = {
    meta: {
      id,
      type: "movie",
      name: movie.title,
      poster: movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null,
      background: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
        : null,
      description: movie.overview,
      releaseInfo: movie.release_date,
      imdbRating: movie.vote_average?.toFixed(1)
    }
  };

  setCache(cacheKey, meta, 1000 * 60 * 60 * 24 * 7); // 7 days
  return meta;
});

/* ================= STREAM (CONFIGURABLE MEDIAFUSION) ================= */

builder.defineStreamHandler(async ({ type, id, config }) => {
  const token = config.token || DEFAULT_MEDIAFUSION_TOKEN;
  const quality = config.quality;

  const url = `https://mediafusion.elfhosted.com/${token}/stream/${type}/${id}.json`;
  const res = await axios.get(url);

  let streams = res.data.streams || [];

  if (quality) {
    streams = streams.filter(s =>
      s.title && s.title.includes(quality)
    );
  }

  return { streams };
});

/* ================= SERVER ================= */

app.use("/addon", builder.getInterface());

app.listen(PORT, () => {
  console.log("Stremio addon running on port " + PORT);
});
