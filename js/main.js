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

function load_gpx(filename) {
    var gpx = new gpxParser();
    fetch(filename)
    .then(response => gpx.parse(response))
    .then(gpx_obj => {return gpx_obj;});
}
