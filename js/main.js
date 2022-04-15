function parse_args() {
    var $_GET = {},
        args = location.search.substr(1).split(/&/);
    for (var i=0; i<args.length; ++i) {
        var tmp = args[i].split(/=/);
        if (tmp[0] != "") {
            $_GET[decodeURIComponent(tmp[0])] = decodeURIComponent(tmp.slice(1).join("").replace("+", " "));
        }
    }

    return $_GET;
}


const argFact = (compareFn) => (array) => array.map((el, idx) => [el, idx]).reduce(compareFn)[1]
const argMax = argFact((min, el) => (el[0] > min[0] ? el : min))
const argMin = argFact((max, el) => (el[0] < max[0] ? el : max))
const __gpxParserTool = new gpxParser()
function distance(a, b) {
    return __gpxParserTool.calcDistanceBetween(a, b);
}
function nearestPointInList(p, points) {
    return argMin(points.map(pp => distance(p, pp)))
}
function representerNearestPointsInTrack(p, gpxTrack, factor, noiseInMeters) {
    const points = gpxTrack.points
    const iNearest = nearestPointInList(p, points);
    const thr = noiseInMeters + factor * distance(p, points[iNearest]);
    const res = [];

    let wasClose = false;
    let iClose = -1;
    for (let i = 0; i < 1 + points.length; i++) {
        const isClose = i < points.length && distance(p, points[i]) < thr;
        if (wasClose !== isClose) {
            if (isClose) {
                iClose = i;
            } else {
                res.push(iClose + nearestPointInList(p, points.slice(iClose, i)));
            }
        }
        wasClose = isClose;
    }
    return res
}

function nearest_point_in_track(lat, lon, array_of_points) {
    var min_dist = Infinity;
    var arg_min = -1;
    for (var i=0; i<array_of_points.length; ++i) {
        var p = array_of_points[i];
        var dist = (p.lat - lat) ** 2 + (p.lon - lon) ** 2;
        if (dist < min_dist) {
            min_dist = dist;
            arg_min = i;
        }
    }
    return arg_min;
}

function compute_dplus_cumul(gpx_track) {
    gpx_track.dplus_cumul = [0];
    for (let i=1; i<gpx_track.points.length; i++) {
        let p_prev = gpx_track.points[i - 1];
        let p = gpx_track.points[i];

        if (p.ele > p_prev.ele) {
            gpx_track.dplus_cumul.push(gpx_track.dplus_cumul[i - 1] + p.ele - p_prev.ele)
        } else {
            gpx_track.dplus_cumul.push(gpx_track.dplus_cumul[i - 1])
        }
    }
    return gpx_track.dplus_cumul
}

function distance_covered(lat, lon, gpx_track) {
    let i = nearest_point_in_track(lat, lon, gpx_track.points);
    return gpx_track.distance.cumul[i];
}

function cumul_dplus(lat, lon, gpx_track) {
    if (!Object.keys(gpx_track).includes("dplus")) {
        compute_dplus_cumul(gpx_track);
    }
    let i = nearest_point_in_track(lat, lon, gpx_track.points);
    return gpx_track.dplus_cumul[i];
}

function distance_covered_first_half(lat, lon, gpx_track) {
    let half = Math.floor(gpx_track.points.length / 2);
    let i = nearest_point_in_track(lat, lon, gpx_track.points.slice(0, half));
    return gpx_track.distance.cumul[i];
}

function distance_covered_second_half(lat, lon, gpx_track) {
    let half = Math.floor(gpx_track.points.length / 2);
    let i = nearest_point_in_track(lat, lon, gpx_track.points.slice(half));
    return gpx_track.distance.cumul[half + i];
}

function cumul_dplus_first_half(lat, lon, gpx_track) {
    if (!Object.keys(gpx_track).includes("dplus")) {
        compute_dplus_cumul(gpx_track);
    }
    let half = Math.floor(gpx_track.points.length / 2);
    let i = nearest_point_in_track(lat, lon, gpx_track.points.slice(0, half));
    return gpx_track.dplus_cumul[i];
}

function cumul_dplus_second_half(lat, lon, gpx_track) {
    if (!Object.keys(gpx_track).includes("dplus")) {
        compute_dplus_cumul(gpx_track);
    }
    let half = Math.floor(gpx_track.points.length / 2);
    let i = nearest_point_in_track(lat, lon, gpx_track.points.slice(half));
    return gpx_track.dplus_cumul[half + i];
}

function valid_get_args($_GET) {
    let keys = Object.keys($_GET);
    return keys.includes("lat") && keys.includes("lon") && keys.includes("track");
    // TODO: test if GPX file exists, test if all params have valid values...
}

function time_to_string(elapsed) {
    let elapsed_h = Math.floor(elapsed / 3600);
    let elapsed_m = Math.floor(elapsed / 60) % 60;
    let elapsed_s = Math.round(elapsed % 60);

    return elapsed_h + "h " + elapsed_m + "m " + elapsed_s + "s";
}

function timestampToDatetimeInputString(timestamp) {
    const date = new Date((timestamp + _getTimeZoneOffsetInMs()));
    // slice(0, 19) includes seconds
    return date.toISOString().slice(0, 19);
}

function _getTimeZoneOffsetInMs() {
    return new Date().getTimezoneOffset() * -60 * 1000;
}