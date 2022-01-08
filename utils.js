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
  this.ts = parseInt(ts); // s
  this.lat = parseFloat(lat);
  this.lon = parseFloat(lon);
}

let reduceSum = [(a, b) => a + b, 0];

function countKeysAmong(o, ...keys) {
  return keys.map((k) => k in o).reduce(...reduceSum);
}

// =============== protectedtex ============
/* Need
    <script src="https://www.protectedtext.com/js/sha512.js"></script>
    <script src="https://www.protectedtext.com/js/aes.js"></script>
  NB: we also use a CORS proxy at heeere.com that has a yes-list of only a few servers (including localhost:7777 and the github of the 3 renards) -->
*/
let protectedTextPassword = "SmcqiZ5qQ9Vd8P9";

function lskeyToDocid(lskey) {
  return "cap_nn___" + lskey;
}
function getProtectedTextURL(docid, get = true, cors = true, pass = undefined) {
  return (
    (cors ? "https://cors.heeere.com/" : "") +
    "https://www.protectedtext.com/" +
    docid +
    (get ? "?action=getJSON" : "") +
    (pass === true ? "?" + protectedTextPassword : pass ? "?" + pass : "")
  );
}
async function appendSharedContent(lskey, v, pass) {
  return await getSharedContent(lskey, pass, v);
}
async function getSharedContent(
  lskey,
  pass = protectedTextPassword,
  alsoAppendValue = undefined
) {
  let docid = lskeyToDocid(lskey);
  let end = CryptoJS.SHA512("/" + docid).toString();
  let req = await fetch(getProtectedTextURL(docid), {
    headers: {
      Pragma: "no-cache",
      "Cache-Control": "no-cache",
    },
  });
  let o = await req.json();
  let raw = CryptoJS.AES.decrypt(o.eContent, pass).toString(CryptoJS.enc.Utf8);
  let content = raw.substr(0, raw.length - end.length);
  if (!alsoAppendValue) {
    return content;
  }
  let initHashContent = content + CryptoJS.SHA512(pass).toString();
  initHashContent = CryptoJS.SHA512(initHashContent).toString() + 2;
  content += "\n" + alsoAppendValue;
  let currentHashContent = content + CryptoJS.SHA512(pass).toString();
  currentHashContent = CryptoJS.SHA512(currentHashContent).toString() + 2;
  let encryptedContent = CryptoJS.AES.encrypt(content + end, pass).toString();
  await fetch(getProtectedTextURL(docid, false), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      initHashContent,
      currentHashContent,
      encryptedContent,
      action: "save",
    }),
  });
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
    return loadModule("./" + relativePath, vueSfcLoaderOptions);
  });
}
