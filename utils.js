// TODO make it async
async function loadGpx(path) {
  const req = await fetch(path);
  const gpx = new gpxParser();
  gpx.parse(await req.text());
  return gpx;
}

// It can be an iso date, or an epoch time in ms or s
function guessTimestamp(s) {
  if (-1 !== s.indexOf("T")) {
    return Date.parse(s);
  }
  let v = parseInt(s);
  if (v < 30000000000) {
    // before end of 1970, so we probably receive sec and not ms
    return 1000 * v;
  } else {
    return v;
  }
}

function getURLParams(url = undefined) {
  const urlSearchParams = new URLSearchParams((url ?? window.location).search);
  return Object.fromEntries(urlSearchParams.entries());
}

// Escape text so that it can be used safely as an html content
function safeHTMLText(txt) {
  return new Option(txt).innerHTML;
}

function Point(ts, lat, lon) {
  this.ts = ts; // s
  this.lat = lat;
  this.lon = lon;
}

let reduceSum = [(a, b) => a + b, 0];

// =============== Vue related ============
const vueSfcLoaderOptions = {
  moduleCache: {
    vue: Vue,
  },
  async getFile(url) {
    const res = await fetch(url);
    if (!res.ok)
      throw Object.assign(
        new Error(res.status + " " + res.statusText + " " + url),
        {
          res,
        }
      );
    return {
      getContentData: (asBinary) => (asBinary ? res.arrayBuffer() : res.text()),
    };
  },
  addStyle(textContent) {
    const style = Object.assign(document.createElement("style"), {
      textContent,
    });
    const ref = document.head.getElementsByTagName("style")[0] || null;
    document.head.insertBefore(style, ref);
  },
};
function asyncComponent(relativePath) {
  const { loadModule } = window["vue3-sfc-loader"];
  return Vue.defineAsyncComponent(() => {
    return loadModule("./" + relativePath, vueSfcLoaderOptions);
  });
}
