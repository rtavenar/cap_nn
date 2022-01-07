<template>
  <div v-if="status === 'ok'">
    <page-title
      :v="
        (LSKey !== gpxURL ? '(' + LSKey + ') ' : '') +
        (gpx.metadata.name ?? 'Suivi Coureur')
      "
    />
    <h1>
      Suivi de coureur sur la trace
      <code :title="gpxURL + ': ' + gpx?.metadata.desc">{{
        gpx.metadata.name ?? gpxURL
      }}</code>
      <span v-if="LSKey !== gpxURL"> ({{ LSKey }})</span>
    </h1>

    <div id="found_tracks">
      <h2><span id="track_name"></span> <span id="track_length"></span></h2>
      <table id="tab-passages"></table>
    </div>

    <div id="map"></div>

    <div id="config">
      <h3>Information et configuration</h3>
      <button
        onclick="clear_state() ; save_state_to_local_storage() ; window.location.reload()"
      >
        Effacer les points et config
      </button>
      <br />
      Date de début :
      <input type="datetime-local" v-model="startTimeAsString" />
      <br />
      <code>{{ niceTimestamp(start) }}</code>
    </div>
  </div>
  <div v-else-if="status === 'loading'">
    <h1>Suivi de coureur sur une trace GPX (HTML/JS only)</h1>
    Loading... please wait.
  </div>
  <div v-else-if="status === 'error'">
    <h1>ERREUR dans le suivi de coureur sur une trace GPX (HTML/JS only)</h1>
    <p id="warning"></p>
    <div v-html="statusErrorMessage"></div>
    <hr />
    Exemple de config SMS : <br /><code
      >{{
        baseURL
      }}?track=migoual-concept-race&lat=%1$f&lon=%2$f&at=%3$ts&start=2022-07-09T06:03</code
    >
    <br /><br />Exemples pour tester le multipoint : <br />
    <ul>
      <li v-for="u in testUrlsToShowOnError" :key="u">
        <a :href="u" target="_blank">{{ u }}</a>
      </li>
    </ul>
  </div>
  <div v-else>status: {{ status }}</div>
</template>
<script>
/* NB: we use the "option" API for simplicity (not the composition API) */
let baseURL = window.location.origin + window.location.pathname;

export default Vue.defineComponent({
  data: () => ({
    status: "none",
    statusErrorMessage: "Unknown error",
    gpxURL: null,
    gpx: null, // TODO check, it might be a performance issue to have the whole gpx reactive
    gpxTrkid: null,
    LSKey: null,
    store: {
      points: [],
      startInMilliseconds: null, // ms
    },
    baseURL,
    testUrlsToShowOnError: [
      "&lat=44.12433&lon=3.13856&at=2022-01-05T06:33",
      "&lat=44.10933&lon=3.30856&at=2022-01-05T12:03",
      "&lat=44.13056&lon=3.38203&at=2022-01-05T15:55", // lanuejols,
      "&lat=44.13078&lon=3.38426&at=2022-01-05T16:23",
      "&lat=44.10517&lon=3.51768&at=2022-01-05T21:12",
      "&lat=44.10433&lon=3.53856&at=2022-01-05T22:03",
    ].map(
      (p) => baseURL + "?track=migoual-concept-race&start=2022-01-05T06:03" + p
    ),
  }),
  computed: {
    // allow a direct use of "start" to get it in seconds
    start() {
      return this.store.startInMilliseconds / 1000;
    },
    // for the input...
    startTimeAsString: {
      get() {
        if (this.store.startInMilliseconds === null) {
        }
        return new Date(this.store.startInMilliseconds)
          .toISOString()
          .replace(/:\d\d\..*/g, "");
      },
      set(v) {
        this.store.startInMilliseconds = guessTimestamp(v);
      },
    },
  },
  mounted() {
    // for debugging, make it accessible as "vm"
    window.vm = this;
    this.status = "loading";
    this.asyncInit();
  },
  methods: {
    niceTimestamp(s) {
      new Date(s * 1000).toISOString().replace(/(T|:\d\d\..*)/g, " ");
    },
    maybeLoadFromLocalStorage(k = undefined) {
      k = k ?? this.LSKey;
      let v = localStorage.getItem(k);
      if (v !== null) {
        this.store = JSON.parse(v);
      }
    },
    saveToLocalStorage(k = undefined) {
      k = k ?? this.LSKey;
      localStorage.setItem(k, JSON.stringify(this.store));
    },
    async asyncInit() {
      if (!(await this.digestURL())) {
        this.status = "error";
        return;
      }
      this.status = "ok";
    },
    async digestURL() {
      let err = "Erreur de paramètres dans l'URL. <br/>";
      const p = getURLParams();
      if ("track" in p && "lat" in p && "lon" in p && "at" in p) {
        const gpxURL = "gpx/" + p.track + ".gpx"; // TODO move this wrapping as a easier to find config
        // We use the gpxURL to allow following several races "at the same time"...
        // We also allow a lskey=... url param to allow following several runners in the same race
        this.LSKey = p.lskey ?? gpxURL;
        this.maybeLoadFromLocalStorage();
        this.gpxTrkid = p.trkid ?? 0;
        try {
          this.gpx = await loadGpx(gpxURL);
        } catch (e) {
          this.statusErrorMessage = `
            ${err} Erreur de chargement du fichier gpx <code>${gpxURL}</code>.
            <br/> <code>${safeHTMLText(e.message)}</code>
            `;
          return false;
        }
        this.gpxURL = gpxURL;
        // base parameters
        // TODO check formats for lat, lon etc
        {
          // digest the query point, use timestamp as identifier
          let ts = guessTimestamp(p.at) / 1000;
          if (this.store.points.map((p) => p.ts).indexOf(ts) === -1) {
            // avoid duplicates
            this.store.points.push(new Point(ts, p.lat, p.lon));
          }
        }

        // optional parameters
        if (this.store.startInMilliseconds === null && "start" in p) {
          this.store.startInMilliseconds = guessTimestamp(p.start);
        }
        return true;
      } else {
        this.statusErrorMessage =
          err +
          "Les arguments <code>lat</code>, <code>lon</code>, <code>track</code> et <code>at</code> sont requis. <br />";
        return false;
      }
    },
  },
});
</script>
<style>
img.estimate {
  filter: hue-rotate(150deg);
}
img.grayscale {
  filter: grayscale(80%);
}
#map {
  resize: both;
  height: 10em;
  margin-top: 2em;
}

table,
th,
td {
  border: 1px solid black;
  border-collapse: collapse;
}
th,
td {
  padding-left: 1em;
  padding-right: 1em;
  text-align: center;
}
.empty {
  background-color: #ccc;
}
</style>