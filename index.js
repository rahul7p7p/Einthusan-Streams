const express = require("express");
const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");

const builder = new addonBuilder({
  id: "org.test.hello",
  version: "1.0.0",
  name: "Hello Test Addon",
  description: "Test addon",
  resources: ["catalog"],
  types: ["movie"],
  catalogs: [
    {
      type: "movie",
      id: "test",
      name: "Test Catalog"
    }
  ]
});

builder.defineCatalogHandler(() => ({
  metas: [
    {
      id: "test:1",
      type: "movie",
      name: "Hello World Movie"
    }
  ]
}));

const app = express();
serveHTTP(builder.getInterface(), { app });

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log("Addon running on port", PORT);
});
