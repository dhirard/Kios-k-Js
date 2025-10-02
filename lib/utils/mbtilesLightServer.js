// Lightweight MBTiles tile server using sql.js (pure WASM) so it works in Electron without native deps
// Serves tiles at: http://localhost:<port>/<layer>/{z}/{x}/{y}.png
// Place your mbtiles as <projectRoot>/renderer/assets/peta.mbtiles or <projectRoot>/peta.mbtiles

const fs = require("fs");
const path = require("path");
const express = require("express");
const initSqlJs = require("sql.js");

/**
 * Create and start an MBTiles server
 * @param {{port:number, domain?:string, mbtilesPath?:string}} opts
 */
async function startMbtilesServer(opts = {}) {
  const port = opts.port || 8080;
  const domain = opts.domain || "localhost";
  const app = express();
  // Basic CORS for file:// renderer
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  const projectRoot = opts.projectRoot || process.cwd();
  const candidates = [
    opts.mbtilesPath,
    path.join(projectRoot, "renderer", "assets", "peta.mbtiles"),
    path.join(projectRoot, "peta.mbtiles"),
  ].filter(Boolean);

  let mbtilesPath = null;
  for (const p of candidates) {
    if (p && fs.existsSync(p)) {
      mbtilesPath = p;
      break;
    }
  }
  if (!mbtilesPath) {
    console.warn(
      "[MAP] peta.mbtiles not found. Expected at:",
      candidates.filter(Boolean).join(" | ")
    );
  }

  const SQL = await initSqlJs({
    locateFile: (file) => require.resolve("sql.js/dist/" + file),
  });
  // Serve static assets from /renderer via /static path for convenience (JSON, images, etc.)
  app.use("/static", express.static(path.join(projectRoot, "renderer")));
  let db = null;
  let metadata = { format: "png", scheme: "tms", minzoom: 0, maxzoom: 19 };

  function openDb() {
    if (!mbtilesPath) return null;
    const data = new Uint8Array(fs.readFileSync(mbtilesPath));
    db = new SQL.Database(data);
    // Load metadata
    try {
      const rs = db.exec("SELECT name, value FROM metadata");
      const map = {};
      if (rs && rs[0]) {
        for (const row of rs[0].values) map[row[0]] = row[1];
      }
      metadata = {
        format: (map.format || "png").toLowerCase(),
        scheme: (map.scheme || map.tile_row_type || "tms").toLowerCase(),
        minzoom: Number(map.minzoom) || 0,
        maxzoom: Number(map.maxzoom) || 19,
        bounds: map.bounds || null,
        name: map.name || path.basename(mbtilesPath, ".mbtiles"),
      };
      console.log(
        `[MAP] MBTiles metadata: format=${metadata.format}, scheme=${metadata.scheme}, zoom=${metadata.minzoom}-${metadata.maxzoom}`
      );
    } catch (e) {
      console.warn("[MAP] failed to read metadata:", e?.message || e);
    }
    return db;
  }

  function getTileBuffer(z, x, y) {
    if (!db) return null;
    const query =
      "SELECT tile_data FROM tiles WHERE zoom_level = :z AND tile_column = :x AND tile_row = :y LIMIT 1";
    const tryFetch = (rowY) => {
      const stmt = db.prepare(query);
      stmt.bind({ ":z": z, ":x": x, ":y": rowY });
      let buf = null;
      while (stmt.step()) {
        const r = stmt.getAsObject();
        if (r.tile_data) {
          buf = Buffer.from(r.tile_data);
          break;
        }
      }
      stmt.free();
      return buf;
    };
    // Preferred based on metadata.scheme
    const isXYZ = (metadata.scheme || "tms").toLowerCase() === "xyz";
    const tmsY = (1 << z) - 1 - y;
    let out = isXYZ ? tryFetch(y) : tryFetch(tmsY);
    if (!out) {
      // Fallback: try the other scheme
      out = isXYZ ? tryFetch(tmsY) : tryFetch(y);
    }
    return out;
  }

  function sniffContentType(buf) {
    if (!buf || buf.length < 4) return "application/octet-stream";
    // PNG signature
    if (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    )
      return "image/png";
    // JPEG signature
    if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
    // GZIP (often for pbf)
    if (buf[0] === 0x1f && buf[1] === 0x8b) return "application/x-protobuf";
    return "application/octet-stream";
  }

  // Simple metadata endpoint
  app.get("/:layer/metadata.json", (req, res) => {
    try {
      if (!db) openDb();
      if (!db) return res.status(404).json({ error: "No MBTiles loaded" });
      const rs = db.exec("SELECT name, value FROM metadata");
      const meta = {};
      if (rs && rs[0]) {
        const columns = rs[0].columns;
        for (const row of rs[0].values) {
          meta[row[0]] = row[1];
        }
      }
      res.json(meta);
    } catch (e) {
      console.error("[MAP] metadata error", e);
      res.status(500).json({ error: "metadata error" });
    }
  });

  // Tile endpoint compatible with Leaflet
  app.get("/:layer/:z/:x/:y.:ext", (req, res) => {
    try {
      if (!db) openDb();
      const { z, x, y, ext } = req.params;
      const zi = parseInt(z, 10),
        xi = parseInt(x, 10),
        yi = parseInt(y, 10);
      const data = getTileBuffer(zi, xi, yi);
      if (!data) {
        console.warn(
          `[MAP] 404 tile not found z=${zi} x=${xi} y=${yi} (scheme=${metadata.scheme})`
        );
        return res.status(404).send("Tile not found");
      }
      // Prefer metadata format, fallback to sniff
      let ct = "image/png";
      const metaFmt = (metadata.format || "").toLowerCase();
      if (metaFmt === "jpg" || metaFmt === "jpeg") ct = "image/jpeg";
      else if (metaFmt === "pbf" || metaFmt === "mvt" || metaFmt === "vector")
        ct = "application/x-protobuf";
      else if (metaFmt === "png") ct = "image/png";
      else ct = sniffContentType(data);
      res.setHeader("Content-Type", ct);
      // If gzipped (common for PBF), hint client to decompress
      if (data && data.length > 2 && data[0] === 0x1f && data[1] === 0x8b) {
        res.setHeader("Content-Encoding", "gzip");
      }
      res.send(data);
    } catch (e) {
      console.error("[MAP] tile error", e);
      res.status(500).send("Tile error");
    }
  });

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(
        `[MAP] 🗺️ Lightweight MBTiles server listening at http://${domain}:${port}`
      );
      if (mbtilesPath) console.log(`[MAP] Using MBTiles: ${mbtilesPath}`);
      console.log(
        `[MAP] Tile URL template: http://${domain}:${port}/peta/{z}/{x}/{y}.png`
      );
      resolve({ app, server, dbPath: mbtilesPath });
    });
  });
}

module.exports = { startMbtilesServer };
