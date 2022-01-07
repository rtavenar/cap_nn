<template>
  <div v-if="status === 'ok'">
    <h1>Suivi de coureur sur une trace GPX (HTML/JS only)</h1>
    <p id="warning"></p>

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
  <div v-else-if="status === 'loading'">Loading... please wait.</div>
  <div v-else-if="status === 'error'">
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
    store: {
      points: [],
      startInMilliseconds: Date.now(), // ms
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
    this.status = "loading";
    if (!this.digestURL()) {
      this.statusErrorMessage =
        "Erreur de paramètres dans l'URL. <br/> Les arguments <code>lat</code>, <code>lon</code>, <code>track</code> et <code>at</code> sont requis. <br />";
      this.status = "error";
    }
    this.status = "error";
  },
  methods: {
    niceTimestamp(s) {
      new Date(s * 1000).toISOString().replace(/(T|:\d\d\..*)/g, " ");
    },
    digestURL() {
      return false;
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