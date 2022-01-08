<template>
  <div v-if="status === 'ok'">
    <page-title
      :v="
        (lskey !== gpxURL ? '(' + lskey + ') ' : '') +
        (gpx.metadata.name ?? 'Suivi Coureur')
      "
    />
    <h1>
      Suivi de coureur sur la trace
      <code :title="gpxURL + ': ' + gpx?.metadata.desc">{{
        gpx.metadata.name ?? gpxURL
      }}</code>
      <span v-if="lskey !== gpxURL"> ({{ lskey }})</span>
    </h1>

    <div id="found_tracks">
      <h2><span id="track_name"></span> <span id="track_length"></span></h2>
      <table id="tab-passages">
        <tr>
          <th>Heure</th>
          <th>Latitude</th>
          <th>Longitude</th>
          <th>Distance (pessimiste)</th>
          <th>Distance (optimiste)</th>
        </tr>
        <tr v-for="r in tableRows" :key="r.ts" :class="{ depart: r.start }">
          <td>
            <i>(Départ)</i>
            {{ niceTimestamp(r.ts) }}
          </td>
          <td>{{ r.lat }}</td>
          <td>{{ r.lon }}</td>
          <td v-if="r.distAlt">
            {{ Math.round(r.distAlt) }}km, {{ Math.round(r.dposAlt) }}D+ ({{
              r.velAlt.toFixed(1)
            }}km/h) ({{
              (((r.distAlt + r.dposAlt / 150) / r.elapsed) * 3600).toFixed(1)
            }}
            strain/h)
          </td>
          <td v-else></td>
          <td v-if="r.dist">
            {{ Math.round(r.dist) }}km, {{ Math.round(r.dpos) }}D+ ({{
              r.vel.toFixed(1)
            }}km/h) ({{
              (((r.dist + r.dpos / 150) / r.elapsed) * 3600).toFixed(1)
            }}
            strain/h)
          </td>
          <td v-else></td>
        </tr>
      </table>
    </div>

    <div id="map"></div>

    <div id="config">
      <h3>Information et configuration</h3>
      <button @click="reloadPage()">Recharger la page</button> (par exemple
      après avoir changé la configuration) <br />
      <button
        onclick="clear_state() ; save_state_to_local_storage() ; window.location.reload()"
      >
        Effacer les points et config (TODO)
      </button>

      <br />
      Partage de suivi (au chargement de la page) :
      <ul>
        <li>
          <label
            ><input type="checkbox" v-model="store.shareNewPoints" /> Partager
            les nouveaux points reçus.</label
          >
        </li>
        <li>
          <label
            ><input type="checkbox" v-model="store.importSharedPoints" />
            Utiliser les nouveaux points partagés par d'autres.</label
          >
        </li>
        <li>
          <a :href="sharedURLlink">Voir et modifier la liste partagée.</a>
        </li>
      </ul>
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
    <br /><br />Exemples pour tester le multipoint : <br /><input
      v-model="testQueryFragmentToAdd"
      style="width: 40em"
    />
    <br />
    <ul>
      <li>
        <a :href="baseURL + testQueryFragmentToAdd"
          >{{ baseURL }}{{ testQueryFragmentToAdd }}</a
        >
      </li>
      <li
        v-for="u in testUrlsToShowOnError"
        :key="u"
        :set="(__u = baseURL + testQueryFragmentToAdd + u)"
      >
        <a :href="__u" target="_blank">{{ __u }}</a>
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
    //gpx: non reactive
    gpxTrkid: null,
    lskey: null,
    saveToLocalStorageOnStoreChange: true,
    store: {
      points: [],
      startInMilliseconds: null, // ms
      shareNewPoints: false,
      importSharedPoints: false,
    },
    baseURL,
    testQueryFragmentToAdd: "?track=migoual-concept-race",
    testUrlsToShowOnError: [
      "&lat=44.12433&lon=3.13856&at=2022-01-05T07:33",
      "&lat=44.10933&lon=3.30856&at=2022-01-05T12:03",
      "&lat=44.13056&lon=3.38203&at=2022-01-05T15:55", // lanuejols,
      "&lat=44.13078&lon=3.38426&at=2022-01-05T16:23",
      "&lat=44.10517&lon=3.51768&at=2022-01-05T21:12",
      "&lat=44.10433&lon=3.53856&at=2022-01-05T22:03",
    ].map((p) => "&start=2022-01-05T06:03" + p),
  }),
  created() {
    this.gpx = null;
  },
  computed: {
    sharedURLlink() {
      return getProtectedTextURL(lskeyToDocid(this.lskey), false, false, true);
    },
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
    // to display the table
    tableRows() {
      if (this.status !== "ok") {
        return [];
      }
      const res = [];
      const track = this.gpx.tracks[this.gpxTrkid];
      let points = this.store.points;

      {
        let p0 = track.points[0];
        res.push({ lat: p0.lat, lon: p0.lon, ts: this.start, start: true });
      }

      let max_dist_first_half = -1;
      let min_dist_second_half = Infinity;
      for (let i = 0; i < points.length; i++) {
        let p = points[i];
        let d_opt = distance_covered_second_half(p.lat, p.lon, track) / 1000; // km
        if (d_opt < min_dist_second_half) {
          min_dist_second_half = d_opt;
        }
      }

      for (let i = 0; i < points.length; i++) {
        let p = points[i];
        let optimistic_is_plausible = true;
        let pessimistic_is_plausible = true;

        let d_opt = distance_covered_second_half(p.lat, p.lon, track) / 1000; // km
        let d_pess = distance_covered_first_half(p.lat, p.lon, track) / 1000; // km
        let deniv_opt = cumul_dplus_second_half(p.lat, p.lon, track);
        let deniv_pess = cumul_dplus_first_half(p.lat, p.lon, track);
        let elapsed = p.ts - this.start; // s

        let v_opt = d_opt / (elapsed / 3600);
        let v_pess = d_pess / (elapsed / 3600);

        if (v_opt > 20 || min_dist_second_half < d_opt - 1) {
          // -1 to keep some GPS error margin
          optimistic_is_plausible = false;
        }
        if (d_pess > max_dist_first_half) {
          max_dist_first_half = d_pess;
        }
        if (max_dist_first_half > d_pess + 1) {
          // +1 to keep some GPS error margin
          pessimistic_is_plausible = false;
        }
        let row = { ...p, elapsed };
        res.push(row);
        if (optimistic_is_plausible) {
          row.dist = d_opt;
          row.dpos = deniv_opt;
          row.vel = v_opt;
        }
        if (pessimistic_is_plausible) {
          row.distAlt = d_pess;
          row.dposAlt = deniv_pess;
          row.velAlt = v_pess;
        }
      }
      return res;
    },
  },
  watch: {
    store: {
      deep: true,
      handler() {
        if (this.saveToLocalStorageOnStoreChange) {
          this.saveToLocalStorage();
        }
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
      return new Date(s * 1000).toISOString().replace(/(T|:\d\d\..*)/g, " ");
    },
    reloadPage() {
      window.location.reload();
    },
    maybeLoadFromLocalStorage(k = undefined) {
      k = k ?? this.lskey;
      let v = localStorage.getItem(k);
      if (v !== null) {
        this.store = JSON.parse(v);
      }
    },
    saveToLocalStorage(k = undefined) {
      k = k ?? this.lskey;
      localStorage.setItem(k, JSON.stringify(this.store));
    },
    async asyncInit() {
      if (!(await this.digestURL())) {
        this.status = "error";
        return;
      }
      this.saveToLocalStorage();
      this.status = "ok";
    },
    async digestURL() {
      let err = "Erreur de paramètres dans l'URL. <br/>";
      const p = getURLParams();
      if ("track" in p) {
        const gpxURL = "gpx/" + p.track + ".gpx"; // TODO move this wrapping as a easier to find config
        // We use the gpxURL to allow following several races "at the same time"...
        // We also allow a lskey=... url param to allow following several runners in the same race
        this.lskey = p.lskey ?? gpxURL;
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
        const nbFromTriplet = "lat lon at"
          .split(" ")
          .map((k) => k in p)
          .reduce(...reduceSum);
        if (nbFromTriplet > 0) {
          if (nbFromTriplet < 3) {
            this.statusErrorMessage =
              err +
              "Les arguments <code>lat</code>, <code>lon</code>, et <code>at</code> vont ensemble.";
            return false;
          }
          // TODO check formats for lat, lon, ts
          // digest the query point, use timestamp as identifier
          let ts = guessTimestamp(p.at) / 1000;
          if (this.store.points.map((p) => p.ts).indexOf(ts) === -1) {
            // avoid duplicates
            this.store.points.push(new Point(ts, p.lat, p.lon));
            this.store.points.sort(function (a, b) {
              return a.ts - b.ts;
            });
          }
        }
        // optional parameters
        if (this.store.startInMilliseconds === null && "start" in p) {
          this.store.startInMilliseconds = guessTimestamp(p.start);
        }
        return true;
      } else {
        this.statusErrorMessage =
          err + "L'argument <code>track</code> est requis. <br />";
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
td:empty {
  background-color: #ccc;
}
tr:not(.depart) i {
  visibility: hidden;
}
</style>