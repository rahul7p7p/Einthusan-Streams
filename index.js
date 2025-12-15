const express = require("express");
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const builder = new addonBuilder({
  id: "org.test.minimal.catalog",
  version: "1.0.0",
  name: "Minimal Test Addon",
  description: "Test catalog",
  resources: ["catalog"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "test",
      name: "Test Movies"
    }
  ]
});

builder.defineCatalogHandler(() => {
  return {
    metas: [
      {
        id: "test:1",
        type: "movie",
        name: "Test Movie"
      }
    ]
  };
});

const app = express();
serveHTTP(builder.getInterface(), { app });

app.listen(process.env.PORT || 7000);
