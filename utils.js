// TODO make it async
function loadGpx(filename) {
  const xhttp = new XMLHttpRequest();
  xhttp.open("GET", filename, false);
  xhttp.send();

  var gpx = new gpxParser();
  gpx.parse(xhttp.responseText);
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
    console.log("./" + relativePath);
    return loadModule("./" + relativePath, vueSfcLoaderOptions);
  });
}
