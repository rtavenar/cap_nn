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

function distance_covered(lat, lon, gpx_track) {
    var i = nearest_point_in_track(lat, lon, gpx_track.points);
    return gpx_track.distance.cumul[i];
}