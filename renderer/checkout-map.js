document.addEventListener("DOMContentLoaded", () => {
  const mapEl = document.getElementById("map");
  if (!mapEl || typeof L === "undefined") {
    console.warn("[MAP] Leaflet or #map element not available on this page");
    return;
  }

  // Initialize map centered over Indonesia
  const initialCenter = [-2.5, 118];
  const initialZoom = 5;
  const map = L.map("map").setView(initialCenter, initialZoom);

  // Try to read metadata to decide raster vs vector
  const metaUrl = "http://localhost:8080/peta/metadata.json";
  const tileRasterUrl = "http://localhost:8080/peta/{z}/{x}/{y}.png";
  const tileVectorUrl = "http://localhost:8080/peta/{z}/{x}/{y}.pbf";

  (async () => {
    try {
      const res = await fetch(metaUrl, { cache: "no-store" });
      const meta = res.ok ? await res.json() : {};
      const fmt = String(meta.format || "png").toLowerCase();
      const minz = Number(meta.minzoom ?? 0) || 0;
      const maxz = Number(meta.maxzoom ?? 19) || 19;
      // Apply min/max zoom
      map.setMinZoom(minz);
      map.setMaxZoom(maxz);

      // If metadata has bounds, set map bounds and center to dataset
      // bounds format: "minLon,minLat,maxLon,maxLat"
      const boundsStr = meta.bounds || meta.BOUNDS || null;
      if (typeof boundsStr === "string" && boundsStr.includes(",")) {
        const parts = boundsStr.split(",").map((n) => Number(n));
        if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
          const [[minLon, minLat], [maxLon, maxLat]] = [
            [parts[0], parts[1]],
            [parts[2], parts[3]],
          ];
          const metaBounds = L.latLngBounds(
            L.latLng(minLat, minLon),
            L.latLng(maxLat, maxLon)
          );
          // If current center not within bounds, fit to bounds
          if (
            !metaBounds.contains(L.latLng(initialCenter[0], initialCenter[1]))
          ) {
            map.fitBounds(metaBounds, { padding: [10, 10] });
          }
        }
      }

      if (fmt === "pbf" || fmt === "mvt" || fmt === "vector") {
        // Vector tiles using VectorGrid
        if (L.vectorGrid && L.vectorGrid.protobuf) {
          // Readable default styles for common OpenMapTiles layers
          const vtStyles = {
            landcover: {
              fill: true,
              fillColor: "#f3f3f3",
              fillOpacity: 1,
              color: "#f3f3f3",
              weight: 0,
            },
            landuse: {
              fill: true,
              fillColor: "#efefef",
              fillOpacity: 1,
              color: "#efefef",
              weight: 0,
            },
            water: {
              fill: true,
              fillColor: "#a0c8f0",
              fillOpacity: 1,
              color: "#90bade",
              weight: 0.5,
            },
            waterway: (p, z) => ({
              color: "#90bade",
              weight: z >= 12 ? 1.5 : z >= 8 ? 1 : 0.5,
              opacity: 0.9,
            }),
            boundary: (p, z) => ({
              color: "#888",
              weight: z >= 6 ? 1.2 : 0.8,
              opacity: 0.6,
              fill: false,
            }),
            transportation: (p, z) => {
              const cls = String(p.class || "").toLowerCase();
              const isMajor = /motorway|trunk|primary/.test(cls);
              const isMinor = /secondary|tertiary|residential|service/.test(
                cls
              );
              return {
                color: isMajor ? "#d77" : isMinor ? "#bbb" : "#ccc",
                weight: isMajor
                  ? z >= 10
                    ? 2.5
                    : 1.5
                  : isMinor
                  ? z >= 12
                    ? 1.8
                    : 1
                  : 0.8,
                opacity: 0.9,
              };
            },
            building: (p, z) => ({
              fill: true,
              fillColor: "#d6d6d6",
              fillOpacity: 0.8,
              color: "#c0c0c0",
              weight: z >= 15 ? 0.8 : 0.3,
            }),
            place: (p, z) =>
              z >= 9
                ? { color: "#555", weight: 0.5, fill: false, opacity: 0.6 }
                : null, // hide at low zoom to reduce clutter
            housenumber: () => null,
            poi: () => null,
          };
          // Fallback style for unknown layers
          vtStyles["*"] = (p, z) => ({
            color: "#aaa",
            weight: 0.5,
            fillColor: "#e6e6e6",
            fillOpacity: 0.6,
          });

          const layer = L.vectorGrid.protobuf(tileVectorUrl, {
            rendererFactory: L.canvas.tile(),
            maxNativeZoom: maxz,
            maxZoom: Math.max(22, maxz),
            interactive: false,
            vectorTileLayerStyles: vtStyles,
          });
          layer.addTo(map);
        } else {
          console.warn(
            "[MAP] VectorGrid not available, falling back to raster URL, may fail"
          );
          L.tileLayer(tileRasterUrl, { maxZoom: 19, minZoom: 0 }).addTo(map);
        }
      } else {
        // Raster tiles
        L.tileLayer(tileRasterUrl, {
          maxZoom: maxz,
          minZoom: minz,
          attribution: "&copy; Offline MBTiles",
        }).addTo(map);
      }
    } catch (e) {
      console.warn("[MAP] Failed to read metadata, using raster fallback", e);
      L.tileLayer(tileRasterUrl, {
        maxZoom: 19,
        minZoom: 0,
        attribution: "&copy; Offline MBTiles",
      }).addTo(map);
    }
  })();

  // Draggable marker
  const marker = L.marker(initialCenter, { draggable: true }).addTo(map);

  // Optional: update a hidden input or textarea with lat/lon when marker moved
  marker.on("moveend", (e) => {
    const { lat, lng } = e.target.getLatLng();
    // For demo, append to address textarea
    const addr = document.getElementById("delivery-address");
    if (addr) {
      const base = addr.value.split("\n")[0] || addr.value;
      addr.value = `${base}\n[Koordinat: ${lat.toFixed(6)}, ${lng.toFixed(6)}]`;
    }
  });

  async function searchAddress(query) {
    try {
      // Use local static server exposed by main process to avoid file:// CORS
      const res = await fetch(
        "http://localhost:8080/static/data/addresses.json",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = await res.json();
      const q = String(query || "")
        .trim()
        .toLowerCase();
      if (!q) return null;
      const found = list.find((it) =>
        String(it.name || "")
          .toLowerCase()
          .includes(q)
      );
      return found || null;
    } catch (err) {
      console.error("[MAP] searchAddress failed:", err);
      return null;
    }
  }

  const searchBtn = document.getElementById("search-button");
  const searchInput = document.getElementById("address-search");

  if (searchBtn && searchInput) {
    searchBtn.addEventListener("click", async () => {
      const q = searchInput.value;
      const result = await searchAddress(q);
      if (result) {
        const { lat, lon } = result;
        const latlng = [Number(lat), Number(lon)];
        map.setView(latlng, 16);
        marker.setLatLng(latlng);
        // Fill address field with matched name
        const addr = document.getElementById("delivery-address");
        if (addr) {
          const extra = `[Koordinat: ${Number(lat).toFixed(6)}, ${Number(
            lon
          ).toFixed(6)}]`;
          addr.value = `${result.name}\n${extra}`;
        }
      } else {
        alert("Alamat tidak ditemukan");
      }
    });

    // Enter key triggers search
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        searchBtn.click();
      }
    });
  }
});
