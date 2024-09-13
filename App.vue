<template>
  <div v-if="status === 'contrib'">
    <div id="link-to-noncontrib">
      <button @click="navigateToNonContrib()">Normal view</button>
    </div>
    <div id="contrib-location">
      <button @click="contributeDeviceLocation()">Contribute location <span v-if="lskey"> ({{ lskey }})</span></button>
      <code>{{ gpxURL }}</code>
    </div>
    <ul id="debug-log">
      <li v-for="l in debug.log">{{l}}</li>
    </ul>
  </div>
  <div v-else-if="status === 'ok'">
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

    <div id="map"></div>

    <ul v-if="debug.on" id="debug-log">
      <li v-for="l in debug.log">{{l}}</li>
    </ul>
    <div v-if="debug.on">
      DEBUG:
      #points = {{ debug.limitPointCount }} <input type="range" v-model.number="debug.limitPointCount" min="0" max="50" />
      // min speed: <input v-model.number="minSpeed" />
      // max speed: <input v-model.number="maxSpeed" />
    </div>

    <div id="found_tracks">
      <h2><span id="track_name"></span> <span id="track_length"></span></h2>
      <table id="tab-passages" :class="tableClasses">
        <tr>
          <th>Heure</th>
          <th>Latitude</th>
          <th>Longitude</th>
          <th v-if="tableHasPessimisticColumn">Au pire</th>
          <th :colspan="tableHasPessimisticColumn ? 1 : 2">Au mieux</th>
        </tr>
        <tr
          v-for="r in tableRows"
          :key="r.ts"
          :class="{ depart: r.start, current: r.ts === currentPointTimestamp, selected: r.ts === selectedPointTimestamp }"
          @click="selectedPointTimestamp = r.ts"
        >
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
            }}{{ff}}/h)
          </td>
          <td v-if="r.dist" :colspan="r.distAlt ? 1 : 2">
            {{ Math.round(r.dist) }}km, {{ Math.round(r.dpos) }}D+ ({{
              r.vel.toFixed(1)
            }}km/h) ({{
              (((r.dist + r.dpos / 150) / r.elapsed) * 3600).toFixed(1)
            }}{{ff}}/h)
          </td>
          <td v-else :colspan="2"></td>
        </tr>
      </table>
      <p>
        Selon le gpx, au total, {{cdsText(distTotal, dposTotal)}}.
      </p>
      <p v-if="eta">
        Estimation de l'arrivée en maintenant le rythme actuel : {{ niceTimestamp(eta) }}. 
      </p>
      <p v-if="eta">
        (clicker sur la trace pour avoir l'estimation de l'heure de passage à cet endroit)
      </p>
    </div>

    <div id="config">
      <h3>Information et configuration</h3>
      <button @click="reloadPage()">Recharger la page</button> (par exemple
      après avoir changé la configuration) <br />

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
          <a :href="sharedURLlink" target="_blank"
            >Voir et modifier la liste partagée.</a
          >
        </li>
      </ul>
      <br />
      Date de début :
      <input type="datetime-local" v-model="startTimeAsString" />
      <br />
      <code>{{ niceTimestamp(start) }}</code>
      <hr />
      <button @click="store.points.splice(0, store.points.length)">
        Effacer les points (localement)
      </button>
      <hr/>
      Config SMS
      <input type="checkbox" v-model="smsWithStart" title="Lien avec heure départ"/>
      <input type="checkbox" v-model="smsWithHour" title="Heure du SMS"/>
      <input type="checkbox" v-model="smsWithGenericLink" title="Ajout lien générique"/>
      <br/><pre><code ref="sms">{{smsURL}}</code></pre>
      <button @click="copy($refs.sms)">Copier dans le presse papier</button>
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
      }}?A=migoual-concept-race,%1$.4f,%2$.4f,%3$ts,2022-07-09T06:03</code
    >
    <br /><br />Exemples pour tester le multipoint : <br /><input
      v-model="testQueryFragmentToAdd"
      style="width: 40em"
    />
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
    ff: "🔥",
    status: "none",
    statusErrorMessage: "Unknown error",
    gpxURL: null,
    //gpx: non reactive
    //pointMarkers: non reactive
    gpxTrkid: null,
    distTotal: 0,
    dposTotal: 0,
    lskey: null,
    saveToLocalStorageOnStoreChange: true,
    store: {
      points: [],
      startInMilliseconds: null, // ms
      shareNewPoints: true,
      importSharedPoints: true,
    },
    debug: {
      on: false,
      limitPointCount: 999,
      log: [],
    },
    minSpeed: 3,
    maxSpeed: 16,
    currentPointTimestamp: null,
    selectedPointTimestamp: null,
    baseURL,
    smsWithStart: true,
    smsWithHour: true,
    smsWithGenericLink: true,
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
    baseURLWithATrack() {
      return this.baseURL + '?A=' + getURLParams().track
    },
    smsURL() {
      let res = this.baseURLWithATrack
      res += ',%1$.4f,%2$.4f,%3$ts'
      if (this.smsWithStart && this.start) {
        res += `,${this.start}`
      }
      if (this.smsWithHour) {
        res += '\n(%3$tT)'
      }
      if (this.smsWithGenericLink) {
        res += '\nhttp://maps.google.com/?ll=%1$.4f,%2$.4f'
      }
      return res
    },
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
        return timestampToDatetimeInputString(this.store.startInMilliseconds);
      },
      set(v) {
        this.store.startInMilliseconds = guessTimestamp(v);
      },
    },
    // to display the table
    tableHasPessimisticColumn() {
      return Math.max(...this.tableRows.map(r => r.distAlt !== undefined))
    },
    eta() {
      if (this.tableRows.length === 0) {
        return null;
      }
      const r = this.tableRows[0]
      const totalStrain = this.distTotal + this.dposTotal / 150
      const currentStrainPerTime = (r.dist + r.dpos / 150) / r.elapsed
      return this.start + totalStrain / currentStrainPerTime
    },
    tableRows() {
      if (this.status !== "ok") {
        return [];
      }
      const track = this.gpx.tracks[this.gpxTrkid];
      let points = this.store.points;

      if (this.debug.on && points.length > this.debug.limitPointCount) {
          points = points.slice(0, this.debug.limitPointCount);
      }

      const cdplus = compute_dplus_cumul(track)

      // a list of lists of int (i.e., for each gps point, the indices of the possible track points)
      let hypothesis = points.map(p => representerNearestPointsInTrack(p, track, 1.5, 30))
      let lastWithoutEmpty = hypothesis
      const hasEmpty = () => Math.max(...hypothesis.map(h => h.length === 0))
      const rememberIfNotEmpty = () => {
        if (!hasEmpty()) {
          lastWithoutEmpty = hypothesis
        }
      }

      //console.log("INIT")
      //console.log(JSON.stringify(hypothesis))
      
      // remove any candidate that does not comply with the speed limits
      hypothesis = hypothesis.map((h, i) => h.filter( ind => {
        const p = points[i];
        let elapsed = p.ts - this.start; // s
        // we keep the points acquired before the start but we will need to handle them
        if (elapsed < 0) {
          return true;
        }
        let v = track.distance.cumul[ind] / 1000 / (elapsed / 3600);
        // we ignore the lower speed limit at the beginning (30min), in case the race starts a little late
        if (elapsed < 30*60) {
          return v < this.maxSpeed;
        }
        return v > this.minSpeed && v < this.maxSpeed;
      }))
      rememberIfNotEmpty()

      // for the before-the-start points, we fake their closest index as being the start point
      hypothesis = hypothesis.map((h, i) => {
        const p = points[i];
        let elapsed = p.ts - this.start; // s
        if (elapsed < 0) {
          return [0]
        }
        return h
      })
      rememberIfNotEmpty()

      //console.log("TOO FAST/SLOW")
      //console.log(JSON.stringify(hypothesis))
      
      { // remove all incoherent points (that come before in the track than the previous one)
        const minH = hypothesis.map(h => Math.min(...h))
        hypothesis = hypothesis.map((h, i) => h.filter(ind => i===hypothesis.length-1 || ind <= minH[i+1]))
      }
      rememberIfNotEmpty()

      //console.log("BEFORE EARLIEST NEXT")
      //console.log(JSON.stringify(hypothesis))

      // fill in the information for the rendering
      let res = [];
      lastWithoutEmpty.forEach((h, i) => {
        const p = points[i]
        const elapsed = p.ts - this.start // s
        const row = { ...p, elapsed }
        res.push(row)
        let ind = h[h.length-1]
        row.dist = track.distance.cumul[ind] / 1000 // km
        row.vel = row.dist / (elapsed / 3600) // km/h
        row.dpos = cdplus[ind]
        if (h.length > 1) {
          ind = h[0]
          row.distAlt = track.distance.cumul[ind] / 1000 // km
          row.velAlt = row.distAlt / (elapsed / 3600) // km/h
          row.dposAlt = cdplus[ind]
        }
      })


      { // insert fake (start) point 
        let p0 = track.points[0];
        res = [
          ...res.filter(p => p.elapsed <= 0).map(p => ({...p, start: true})),
          { lat: p0.lat, lon: p0.lon, ts: this.start, start: true },
          ...res.filter(p => p.elapsed > 0),
        ]
      }

      res.reverse() // most recent on top to avoid needing to scroll
      return res
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
    selectedPointTimestamp() {
      if (this.pointMarkers) {
        for (let i in this.pointMarkers) {
          let isSel = this.store.points[i].ts === this.selectedPointTimestamp;
          this.pointMarkers[i]._icon.style.outline = isSel ? "3px solid red" : null;
          //this.pointMarkers[i]._icon.classList.toggle('selected-marker', isSel);
        }
      }
    },
  },
  mounted() {
    // for debugging, make it accessible as "vm"
    window.vm = this;
    this.status = "loading";
    this.asyncInit();
  },
  methods: {
    cdsText(dist, dpos) {
      const eff = dist + dpos / 150;
      return `${dist.toFixed(1)}km, ${dpos.toFixed(0)}D+ (${eff.toFixed(0)}${this.ff})`;
    },
    estimateAsTooltip(ll) {
      const track = this.gpx.tracks[this.gpxTrkid];
      const cdplus = compute_dplus_cumul(track)
      const nearests = representerNearestPointsInTrack({lat:ll.lat, lon:ll.lng}, track, 1.5, 30)
      const strains = nearests.map(i => [i, track.distance.cumul[i] / 1000 + cdplus[i] / 150])
      const getStrain = r => r.start ? 0 : r.dist + r.dpos / 150
      console.log(this.tableRows.length, this.tableRows[0])
      if (this.tableRows.length === 0 || ! this.tableRows[0].dist) {
        return nearests.map(i => this.cdsText(track.distance.cumul[i] / 1000, cdplus[i])).join("<br/>");
      }
      const times = strains.map(([i,s]) => {
        let iafter = this.tableRows.length - 1
        for (; iafter >= 0 ; iafter--) {
          if (s < this.tableRows[iafter].dist + this.tableRows[iafter].dpos / 150) {
            break
          }
        }
        if (iafter === -1) {
          const r = this.tableRows[0]
          const currentStrainPerTime = getStrain(r) / r.elapsed
          return [i, this.start + s / currentStrainPerTime]
        } else {
          const r1 = this.tableRows[iafter+1]
          const r2 = this.tableRows[iafter]
          const s1 = getStrain(r1)
          const s2 = getStrain(r2)
          const t1 = r1.elapsed || 0
          const t2 = r2.elapsed || 0
          return [i, this.start + t1 + (s-s1)/(s2-s1) * (t2-t1)]
        }
      })
      return times.map(([i,t]) => this.niceTimestamp(t)+"<br/> └─ "+this.cdsText(track.distance.cumul[i] / 1000, cdplus[i])).join("<br/>")
    },
    niceTimestamp(s) {
      //new Date(s * 1000).toLocaleString();
      let str = timestampToDatetimeInputString(s * 1000);
      return str.replace(/(T|:\d\d\..*)/g, " ");
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
      const st = await this.digestURL();
      if (typeof st === 'string') {
        this.status = st;
        return;
      }
      if (st === false) {
        this.status = "error";
        return;
      }
      this.saveToLocalStorage(); // just to be sure, but it is probably ok with the watch
      this.drawMap();
      this.status = "ok";
    },
    async copy(ref) {
      await navigator.clipboard.writeText(ref.textContent);
      ref.classList.add("copied");
    },
    drawMap() {
      if (!document.getElementById("map")) {
        // not mounted yet?
        window.setTimeout(() => this.drawMap(), 1);
        return;
      }
      const track = this.gpx.tracks[this.gpxTrkid];
      const mymap = L.map("map");

      new ResizeObserver(() => {
        mymap.invalidateSize();
      }).observe(document.getElementById("map"));

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 50,
      }).addTo(mymap);

      let coordinates = track.points.map((p) => [
        p.lat.toFixed(5),
        p.lon.toFixed(5),
      ]);
      var polyline = L.polyline(coordinates, {
        weight: 10,
        color: "darkred",
        opacity: 0.5,
      }).addTo(mymap);

      polyline.on("click", (ev) => {
        let ll = ev.latlng;
        let m = L.marker(ll).addTo(mymap);
        m._icon.classList.add("estimate");
        m.bindTooltip(this.estimateAsTooltip(ll), {permanent: true});
        //m.bindTooltip(estimate_to_html(estimate_progress(ll))) // TODO
        m.on("click", () => {
          m.remove();
          console.log(`&lat=${ll.lat.toFixed(5)}&lon=${ll.lng.toFixed(5)}&at=`); // helper to create test URLs
        });
      });

      // zoom the map to the polyline
      mymap.fitBounds(polyline.getBounds());

      let end = Math.max(...this.store.points.map((p) => p.ts));
      let ts = this.currentPointTimestamp;
      this.pointMarkers = []
      for (let p of this.store.points) {
        let m = L.marker([p.lat, p.lon]).addTo(mymap);
        this.pointMarkers.push(m)
        m.bindTooltip(`${this.niceTimestamp(p.ts)}<br/>
                    Temps écoulé : <b>${time_to_string(p.ts - this.start)}</b>
                    `);
        m.on("click", () => {
          this.selectedPointTimestamp = p.ts;
        });
        if (p.ts !== ts) {
          m._icon.style.filter = `grayscale(${
            80 - (80 * (p.ts - this.start)) / (end - this.start)
          }%)`;
          //m._icon.style.filter = `hue-rotate(${100 * (p.ts-this.start)/(end-this.start)}deg)`;
        } else {
          m._icon.style.filter = `brightness(150%)`;
        }
      }
    },
    async digestURL() {
      let err = "Erreur de paramètres dans l'URL. <br/>";
      const p = getURLParams();
      if ("debug" in p) {
        this.debug.on = true;
      }
      if ("contrib" in p) {
        const gpxURL = "gpx/" + p.track + ".gpx"; // TODO move this wrapping as a easier to find config
        this.lskey = p.lskey ?? gpxURL; // also used for protectedtext sharing
        this.gpxURL = gpxURL;
        return "contrib";
      }
      if ("track" in p) {
        const gpxURL = "gpx/" + p.track + ".gpx"; // TODO move this wrapping as a easier to find config
        // We use the gpxURL to allow following several races "at the same time"...
        // We also allow a lskey=... url param to allow following several runners in the same race
        // NB: see param parsing for short notation of gpxURL+lskey
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
        const nbFromTriplet = countKeysAmong(p, "lat", "lon", "at");
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
          this.currentPointTimestamp = ts;
          if (this.store.shareNewPoints) {
            try {
              await appendSharedContent(
                this.lskey,
                this.niceTimestamp(ts) + "\n" + window.location.toString() + "\n"
              );
            } catch (e) {
              // e.g. cors limitations
              console.log("APPEND SHARED FAILED", e)
            }
          }
          // avoid duplicates
          if (this.store.points.map((p) => p.ts).indexOf(ts) === -1) {
            this.store.points.push(new Point(ts, p.lat, p.lon));
          }
        }
        // optional parameters
        if (this.store.startInMilliseconds === null && "start" in p) {
          this.store.startInMilliseconds = guessTimestamp(p.start);
        }
        // import points from the remote pad
        if (this.store.importSharedPoints) {
          try {
            let sharedContent = await getSharedContent(this.lskey);
            for (let l of sharedContent
              .split("\n")
              .filter((l) => l.startsWith(this.baseURL))) {
              // we redo mostly as above... some repetition
              let p = getURLParams(new URL(l));
              if (countKeysAmong(p, "lat", "lon", "at") == 3) {
                let ts = guessTimestamp(p.at) / 1000;
                if (this.store.points.map((p) => p.ts).indexOf(ts) === -1) {
                  this.store.points.push(new Point(ts, p.lat, p.lon));
                }
              }
            }
          } catch (e) {
            // e.g. cors limitations
            console.log("GET SHARED FAILED", e)
          }
        }
        // ensure points are sorted
        this.store.points.sort(function (a, b) {
          return a.ts - b.ts;
        });

        const sps = this.store.points;
        if (this.currentPointTimestamp === null && sps.length > 0) {
          this.currentPointTimestamp = sps[sps.length - 1].ts;
        }

        { // compute track total stats
          const track = this.gpx.tracks[this.gpxTrkid];
          const cdplus = compute_dplus_cumul(track);
          this.distTotal = track.distance.cumul[track.distance.cumul.length-1] / 1000;
          this.dposTotal = cdplus[cdplus.length-1];
        }

        return true;
      } else {
        this.statusErrorMessage =
          err + "L'argument <code>track</code> est requis. <br />";
        return false;
      }
    },
    navigateToNonContrib() {
      const params = new URLSearchParams(window.location.search);
      params.delete("contrib");
      window.location.search = params;
    },
    contributeURL(lat, lon, ts) {
      let res = this.baseURLWithATrack
      res += `,${lat.toFixed(4)},${lon.toFixed(4)},${ts}`
      return res
    },
    async contributeDeviceLocation() {
      try {
        const pos = await getCurrentPosition({ /*enableHighAccuracy: true <- timeouting in firefox mobile...,*/ timeout: 15000, maximumAge: 10000 });
        const ts = Math.round(pos.timestamp/1000)
        const url = this.contributeURL(pos.coords.latitude, pos.coords.longitude, ts)
        this.debug.log.push(url)
        await appendSharedContent(
          this.lskey,
          this.niceTimestamp(ts) + "\n" + url + "\n"
        );
        if (this.debug.log.slice(-1)[0] === url) {
          this.debug.log.splice(-1, 1);
        }
        this.debug.log.push("ok... "+url)
      } catch (e) {
        this.debug.log.push(safeHTMLText(e.message))
      };
    },
  },
});
</script>
<style>
body {
  --map-height: 50vh;
}
img.estimate {
  filter: hue-rotate(150deg);
}
img.grayscale {
  filter: grayscale(80%);
}
#map {
  resize: both;
  height: var(--map-height);
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
tr.selected td:first-of-type {
  background: #FCC;
}
tr.current td:first-of-type {
  color: teal;
}
.copied {
  background: green;
  color: white;
}
.copied::after {
  content: "copied";
  position: relative;
  top: -1em;
  border: 1px solid black;
  background: yellow;
  color: black;
}
#link-to-noncontrib {
  text-align: center;
  padding: 20px;
  padding-bottom: 60px;
}
#link-to-noncontrib button {
  font-size: 20px;
}
#contrib-location button {
  padding: 1em;
  font-size: 30px;
  margin: 0 1em;
}
</style>
