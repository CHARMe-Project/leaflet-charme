var MINI = require('minified');
var _ = MINI._,
    $ = MINI.$,
    $$ = MINI.$$,
    EE = MINI.EE,
    HTML = MINI.HTML;

var drawnThing;
var formThing;

document.addEventListener('DOMContentLoaded', function () {
    // Set up maps
    var layer1 = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>',
        maxZoom: 18
    });

    var map = L.map('map', {
        layers: [layer1],
        center: [55, -3.5],
        zoom: 6
    });

    var featureGroup = new L.FeatureGroup();
    map.addLayer(featureGroup);
    // Set the title to show on the polygon button
    L.drawLocal.draw.toolbar.buttons.polygon = 'Comment on a general region of data';
    L.drawLocal.draw.toolbar.buttons.rectangle = 'Comment on a rectangular region of data';
    L.drawLocal.draw.toolbar.buttons.marker = 'Comment on data at a point';

    var drawControl = new L.Control.Draw({
        position: 'topleft',
        draw: {
            polyline: false,
            circle: false,
            marker: true,
            polygon: true
        }
    });
    map.addControl(drawControl);


    //Custom functions upon 'edit'
    map.on('draw:created', function (e) {
        // Can do e.layer._latlngs if e.layerType is "rectangle" or "polygon"
        // Do if (layer instanceof L.Polyline)

        // Can do e.layer._latlng if e.layerType is "marker"
        // Do if (layer instanceof L.Marker)
        var coords = e.layer._latlng;
        drawnThing = e;
        var tempMarker = featureGroup.addLayer(e.layer);
        var popupContent = '<form id="form">' +
            'Name:<br>' +
            '<input type="text" id="name" name="name"><br>' +
            'Email:<br>' +
            '<input type="text" id="email" name="email"><br>' +
            'Author URI:<br>' +
            '<input type="text" id="authoruri" name="authoruri"><br>' +
            'Comment:<br>' +
            '<textarea id="comment" name="comment" cols="35" rows="5" wrap="soft" form="form"></textarea>' +
            '<input id="submit" type="submit" value="Submit">' +
            '</form>';

        tempMarker.bindPopup(popupContent, {
            keepInView: true,
            closeButton: false
        }).openPopup();

        var datasetUri = 'http://dataset/uri';
        var datasetVar = 'selectedVar';
        var endpointUrl = 'http://192.168.56.102/';
        var token = 'd4b0cf754c6bfe5208182325d96c1d5dec5964ba';

        $('#submit').on('click', function () {
            var name = $$("#name").value;
            var email = $$("#email").value;
            var authorUri = $$("#authoruri").value;
            var comment = $$("#comment").value;
            //            console.log(name);//            console.log(email);
            //            console.log(authorUri);
            //            console.log(comment);
            //            console.log(location);
            var location = getLocationString(e.layer);
            var ttl = getTurtle(name, email, authorUri, datasetUri, datasetVar, location, comment);

            var headers = {
                'Content-Type': 'text/turtle',
                'Authorization': 'Token ' + token,
            };
            $.request('post', endpointUrl + 'insert/annotation', ttl, {
                'headers': headers
            }).then(function (txt) {
                console.log(txt);
            }).error(function () {
                console.log('Failed!');
            });
            console.log(ttl);
            featureGroup.removeLayer(e.layer);
        });

    });
});

function getLocationString(layer) {
    // Can do e.layer._latlngs if e.layerType is "rectangle" or "polygon"
    // Do if (layer instanceof L.Polyline)

    // Can do e.layer._latlng if e.layerType is "marker"
    // Do if (layer instanceof L.Marker)
    if (layer instanceof L.Marker) {
        console.log(layer._latlng);
        return 'POINT (' + layer._latlng['lng'] + ' ' + layer._latlng['lat'] + ')'
    } else if (layer instanceof L.Polyline) {
        // Reverse order of points to ensure they are anti-clockwise
        var poly = 'POLYGON ((';
        for (var i = layer._latlngs.length - 1; i >= 0; i--) {
            // Be careful here - may need to reverse the order for Strabon
            var latlng = layer._latlngs[i];
            poly = poly + latlng['lng'] + ' ' + latlng['lat'] + ', ';
        }
        poly = poly + layer._latlngs[layer._latlngs.length - 1]['lng'] + ' ' + layer._latlngs[0]['lat'] + '))';
        return poly;
    }
}

function getTurtle(name, email, authorUri, datasetUri, datasetVar, location, comment) {
    var dateTime = new Date();
    var ttl = '@prefix chnode: <http://localhost/> .' +
        '@prefix charme: <http://purl.org/voc/charme#> .' +
        '@prefix oa: <http://www.w3.org/ns/oa#> .' +
        '@prefix foaf: <http://xmlns.com/foaf/0.1/> .' +
        '@prefix prov: <http://www.w3.org/ns/prov#> .' +
        '@prefix xsd: <http://www.w3.org/2001/XML-Schema#> .' +
        '@prefix geo: <http://www.opengis.net/ont/geosparql#> .' +
        '@prefix cnt: <http://www.w3.org/2011/content#> .' +
        '@prefix dc: <http://purl.org/dc/elements/1.1/> .' +
        '@prefix dctypes: <http://purl.org/dc/dcmitype/> .' +
        '<chnode:annoID> a oa:Annotation ;' +
        '    oa:annotatedAt "' + dateTime.toISOString() + '" ;' +
        '    oa:annotatedBy <' + authorUri + '> ;' +
        '    oa:hasTarget <chnode:targetID> ;' +
        '    oa:hasBody <chnode:bodyID> ;' +
        '    oa:motivatedBy oa:linking .' +
        '<' + authorUri + '> a foaf:Person ;' +
        '    foaf:mbox <mailto:' + email + '> ;' +
        '    foaf:name "' + name + '" .' +
        '<chnode:targetID> a charme:DatasetSubset ;' +
        '    oa:hasSource <' + datasetUri + '> ;' +
        '    oa:hasSelector <chnode:subsetSelectorID> .' +
        '<' + datasetUri + '> a charme:dataset .' +
        '<chnode:subsetSelectorID> a charme:SubsetSelector ;' +
        '    charme:hasVariable <chnode:variableID-01> ;' +
        '    charme:hasSpatialExtent <chnode:spatialExtentID-01> .' +
        '<chnode:bodyID> a cnt:ContentAsText, dctypes:Text ;' +
        '    cnt:chars "' + comment + '" ;' +
        '    dc:format "text/plain" .    ' +
        '<chnode:variableID-01> a charme:Variable ;' +
        '    charme:hasInternalName "' + datasetVar + '" .' +
        '<chnode:spatialExtentID-01> a charme:SpatialExtent ;' +
        '    geo:hasGeometry <chnode:geometryID-01> .' +
        '<chnode:geometryID-01> a geo:Geometry ;' +
        '    geo:asWKT "' + location + '"^^geo:wktLiteral .';
    return ttl;
}