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


function GPXParser(xmlDoc) {
    this.xmlDoc = xmlDoc;
}

GPXParser.prototype.getTrackSegment = function(trackSegmentElement) {
    var trackpointElements = trackSegmentElement.getElementsByTagName("trkpt");
    var trackPoints = [];

    for(var i = 0; i < trackpointElements.length; i++) {
        var trackpointElement = trackpointElements[i];
        var lng = parseFloat(trackpointElement.getAttribute("lon"));
        var lat = parseFloat(trackpointElement.getAttribute("lat"));
        var point = {lat: lat, lng: lng};

        var elevationElements = trackpointElement.getElementsByTagName("ele");
        if (elevationElements.length > 0) {
            point.elevation = parseFloat(elevationElements[0].childNodes[0].nodeValue);
        }
        trackPoints.push(point);
    }

    return {trackPoints: trackPoints};
}

GPXParser.prototype.getTrack = function(trackElement) {
    var segmentElements = trackElement.getElementsByTagName("trkseg");
    var segments = [];
    for(var i = 0; i < segmentElements.length; i++) {
        var segment = this.getTrackSegment(segmentElements[i]);
        segments.push(segment);
    }
    return {segments: segments };
}


GPXParser.prototype.getTracks = function() {
    var trackElements = this.xmlDoc.documentElement.getElementsByTagName("trk");
    var tracks = [];
    for(var i = 0; i < trackElements.length; i++) {
        var track = this.getTrack(trackElements[i]);
        tracks.push(track);
    }
    return tracks;
}

