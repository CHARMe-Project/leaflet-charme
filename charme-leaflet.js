var MINI = require('minified');
var _ = MINI._,
    $ = MINI.$,
    $$ = MINI.$$,
    EE = MINI.EE,
    HTML = MINI.HTML;

/**
 * Instantiate a new CharmeAnnotator
 * 
 * @param charmeUrl
 *            The URL of the CHARMe node to use. This node needs to be running
 *            the CHARMe node software 0.8.6.dev3 or above.
 * @param charmeClientId
 *            The client ID registered on the CHARMe node. Note that the client
 *            registered on the CHARMe node must also have it's redirect URL set
 *            to the page that this is being served from
 * @param map
 *            The leaflet map to add the annotation controls to
 */
function CharmeAnnotator(charmeUrl, charmeClientId, map) {
    this.charmeUrl = charmeUrl;

    /*
     * Initialise the OAuth2 object, setting the redirect URL to the current
     * page (minus any parameters)
     */
    this.charmeOAuth = new JSO({
        providerID: 'charme-local',
        client_id: charmeClientId,
        redirect_uri: [location.protocol, '//', location.host,
				location.pathname].join(''),
        authorization: charmeUrl + 'oauth2/authorize'
    });

    /*
     * Initialise some properties
     */
    this.map = map;
    this.drawControl = undefined;
    this.annotationsGroup = undefined;
    this.annotationsOn = false;

    this.loggedInCallback = undefined;
    this.datasetUri = undefined;
    this.datasetVar = undefined;

    this.loggedOutCallback = undefined;
    this.formatAnnotation = undefined;
    this.token = undefined;

    /*
     * Call the init method
     */
    this._init();
}

/**
 * Does the initialisation, storing the OAuth token and adding controls to the
 * map.
 */
CharmeAnnotator.prototype._init = function () {
    /*
     * Add a layer to view existing annotations on
     */
    this.annotationsGroup = new L.FeatureGroup();
    this.map.addLayer(this.annotationsGroup);

    /*
     * This should be called on first load of the page. It handles the case
     * where the page is being loaded as a redirect after logging into the
     * CHARMe node
     */
    this.charmeOAuth.callback();
    /*
     * Get the token if it's present.
     */
    var tokenObj = this.charmeOAuth.checkToken();

    if (tokenObj) {
        /*
         * We are logged into a CHARMe node. Either we have just been redirected
         * back, or we were already logged in from a previous session...
         */
        this.token = tokenObj['access_token'];

        /*
         * Used to access the CharmeAnnotator in methods where this gets
         * overridden
         */
        var that = this;

        /*
         * Get the user details and call the logged-in callback (if present)
         */
        $.request('get', this.charmeUrl + 'token/userinfo', null, {
            'headers': {
                'Authorization': 'Token ' + this.token,
            }
        }).then(
            function (resp) {
                var userdetails = JSON.parse(resp);
                if (that.loggedInCallback && that.loggedInCallback instanceof Function) {
                    that.loggedInCallback(userdetails);
                }
            });

        /*
         * Add the commenting tools to the map
         */
        var featureGroup = new L.FeatureGroup();
        this.map.addLayer(featureGroup);
        L.drawLocal.draw.toolbar.buttons.polygon = 'Comment on a general region of data';
        L.drawLocal.draw.toolbar.buttons.rectangle = 'Comment on a rectangular region of data';
        L.drawLocal.draw.toolbar.buttons.marker = 'Comment on data at a point';
        this.drawControl = new L.Control.Draw({
            position: 'topleft',
            draw: {
                polyline: false,
                circle: false,
                marker: true,
                polygon: true,
                rectangle: true
            }
        });
        this.map.addControl(this.drawControl);

        /*
         * Wire up what happens when we add comments
         */
        this.map.on('draw:created', function (e) {
            /*
             * Create a temporary marker with an open popup
             * containing a form for submitting a comment
             */
            var tempMarker = featureGroup.addLayer(e.layer);
            var popupContent = '<form id="annoForm">' + 'Comment:<br>' + '<textarea id="annoComment" name="comment" cols="35" rows="5" wrap="soft" form="form"></textarea>' + '<input id="annoSubmit" type="submit" value="Submit">' + '</form>';

            var popupform = $('#annoForm');
            var popup = tempMarker.bindPopup(popupContent, {
                keepInView: true,
                closeButton: true
            });

            popup.openPopup();
            popup.on('popupclose', function (e) {
                /*
                 * Remove the temporary marker if the popup is
                 * closed
                 */
                featureGroup.removeLayer(e.layer)
            });

            $('#annoSubmit').on('click', function () {
                /*
                 * When the submit button is
                 * clicked, get the comment
                 */
                var comment = $$("#annoComment").value;
                /*
                 * Get the location of the
                 * annotation
                 */
                var location = that._getLocationString(e.layer);
                /*
                 * Convert to TTL format ready
                 * to post to the CHARMe node
                 */
                var ttl = that._getTurtle(that.datasetUri, that.datasetVar, location, comment);

                if (!that.token) {
                    /*
                     * Technically not necessary any more - we should
                     * always have the token by this point.
                     * 
                     * However, if not, we retrieve it...
                     */
                    jso.getToken(function (tkn) {
                        that.token = tkn.access_token;
                    });
                }

                /*
                 * Post the TTL to the CHARMe node
                 */
                $.request('post', that.charmeUrl + 'insert/annotation', ttl, {
                    'headers': {
                        'Content-Type': 'text/turtle',
                        'Authorization': 'Token ' + that.token,
                    }
                }).then(function () {
                    if (that.annotationsOn) {
                        /*
                         * Switch annotations off and on again to refresh
                         */
                        that.toggleAnnotations();
                        that.toggleAnnotations();
                    }
                }).error(function () {
                    console.log('Problem creating annotation');
                });
                featureGroup.removeLayer(e.layer);
            });
        });
    }
}

/**
 * Sets the dataset URI and variable to be used for comments
 * 
 * @param uri
 *            The URI of the dataset being commented on
 * @param variable
 *            The ID the of variable being commented on
 */
CharmeAnnotator.prototype.setDatasetDetails = function (uri, variable) {
    this.datasetUri = uri;
    this.datasetVar = variable;
}

/**
 * Logs onto the CHARMe node
 */
CharmeAnnotator.prototype.charmeLogin = function () {
    this.charmeOAuth.getToken(function (tkn) {
        /*
         * No Need to do anything here - we store the token after the redirect -
         * same with the loggedInCallback
         */
    });
}

/**
 * Logs out of the CHARMe node
 */
CharmeAnnotator.prototype.charmeLogout = function () {
    this.charmeOAuth.wipeTokens();
    this.token = undefined;
    if (this.loggedOutCallback && this.loggedOutCallback instanceof Function) {
        this.loggedOutCallback();
    }
    this.map.removeControl(this.drawControl);
}

/**
 * Sets the function to be called after login
 * 
 * @param f
 *            A function which takes a single argument, userdetails. This is an
 *            object containing the fields "username", "first_name", and
 *            "last_name"
 */
CharmeAnnotator.prototype.setLoggedInCallback = function (f) {
    this.loggedInCallback = f;
}

/**
 * Sets the function to be called after logout
 * 
 * @param f
 *            A function which takes no arguments
 */
CharmeAnnotator.prototype.setLoggedOutCallback = function (f) {
    this.loggedOutCallback = f;
}

/**
 * Sets the function to use to format the annotations to be displayed.
 * 
 * @param f
 *            A function which takes a single argument which will be an object
 *            containing the fields "text", "firstname", "surname", "email",
 *            "time". It should return a string containing the HTML snippet to
 *            display in the annotation popup
 */
CharmeAnnotator.prototype.setFormatAnnotation = function (f) {
    this.formatAnnotation = f;
}

/**
 * Toggles the available annotations on/off. Use isAnnotationsOn() to check the
 * current state
 */
CharmeAnnotator.prototype.toggleAnnotations = function () {
    if (this.annotationsOn) {
        /*
         * If annotations are already on, clear them from the map
         */
        this.annotationsGroup.clearLayers();
        this.annotationsOn = false;
    } else {
        /*
         * Otherwise, query the CHARMe node and retrieve the results in GeoJSON
         * format
         */
        var params = {
            'query': this._getQuery(this.datasetUri, this.datasetVar),
            'format': 'GeoJSON'
        };
        var that = this;
        $.request('get', 'http://192.168.56.102:8080/strabonendpoint/Query', params, {
            'headers': {
                'Accept': 'application/json'
            }
        }).then(function (resp) {
            L.geoJson(JSON.parse(resp), {
                onEachFeature: function (feature, layer) {
                    if (feature.properties) {
                        var p = feature.properties;
                        var popupText = ''
                        if (that.formatAnnotation && that.formatAnnotation instanceof Function) {
                            /*
                             * We can either use a user-supplied
                             * format for the annotation...
                             */
                            popupText = that.formatAnnotation(p);
                        } else {
                            /*
                             * ...or use this default format
                             */
                            if (p.text) {
                                popupText += p.text + '<br><br>';
                            }
                            if (p.time) {
                                popupText += 'Annotated at ' + p.time + ' by:<br>';
                            }
                            if (p.email) {
                                popupText += '<a href="mailto:' + p.email + '">';
                            }
                            if (p.firstname && p.surname) {
                                popupText += '<b>' + p.firstname + ' ' + p.surname + '</b><br>';
                            }
                            if (p.email) {
                                popupText += '</a>';
                            }
                        }
                        layer.bindPopup(popupText);
                    }
                }
            }).addTo(that.annotationsGroup);
        });
        this.annotationsOn = true;
    }
}

/**
 * Checks whether annotations are currently displayed on the map.
 */
CharmeAnnotator.prototype.isAnnotationsOn = function () {
    return this.annotationsOn;
}

/**
 * Construct the SPARQL query to get all annotations for the current dataset/variable
 */
CharmeAnnotator.prototype._getQuery = function (datasetUri, datasetVariable) {
    var query = 'PREFIX charme: <http://purl.org/voc/charme#> ' +
        'PREFIX oa: <http://www.w3.org/ns/oa#> ' +
        'PREFIX geo: <http://www.opengis.net/ont/geosparql#> ' +
        'PREFIX geof: <http://www.opengis.net/def/function/geosparql/> ' +
        'PREFIX cnt: <http://www.w3.org/2011/content#> ' +
        'PREFIX foaf: <http://xmlns.com/foaf/0.1/> ' +
        'SELECT ?wkt ?text ?firstname ?surname ?email ?time ?account ' +
        'WHERE { ' +
        '    ?anno oa:hasBody ?body . ' +
        '    ?anno oa:annotatedBy ?authorUri . ' +
        '    ?anno oa:annotatedAt ?time . ' +
        '    ?authorUri foaf:givenName ?firstname . ' +
        '    ?authorUri foaf:familyName ?surname . ' +
        '    ?authorUri foaf:mbox ?email . ' +
        '    ?authorUri foaf:accountName ?account . ' +
        '    ?body cnt:chars ?text . ' +
        '    ?anno oa:hasTarget ?target . ' +
        '    ?target oa:hasSelector ?selector . ' +
        '    ?selector charme:hasSpatialExtent ?sp . ' +
        '    ?sp geo:hasGeometry ?geometry . ' +
        '    ?geometry geo:asWKT ?wkt . ' +
        '    ?datasetUri a charme:dataset . ' +
        '    ?selector charme:hasVariable ?variableUri . ' +
        '    ?variableUri charme:hasInternalName ?variableName . ' +
        'FILTER(?variableName="' + datasetVariable + '") . ' +
        'FILTER(str(?datasetUri)="' + datasetUri + '") . ' + '} ';
    return query;
}

/**
 * Constructs the WKT location string for a drawn object 
 */
CharmeAnnotator.prototype._getLocationString = function (layer) {
    if (layer instanceof L.Marker) {
        return 'POINT (' + layer._latlng['lng'] + ' ' + layer._latlng['lat'] + ')'
    } else if (layer instanceof L.Polyline) {
        // Reverse order of points to ensure they are anti-clockwise
        var poly = 'POLYGON ((';
        for (var i = layer._latlngs.length - 1; i >= 0; i--) {
            // Be careful here - may need to reverse the order for Strabon
            var latlng = layer._latlngs[i];
            poly = poly + latlng['lng'] + ' ' + latlng['lat'] + ', ';
        }
        poly = poly + layer._latlngs[layer._latlngs.length - 1]['lng'] + ' ' + layer._latlngs[layer._latlngs.length - 1]['lat'] + '))';
        return poly;
    }
}

/**
 * Constructs the turtle needed to insert an annotation.
 */
CharmeAnnotator.prototype._getTurtle = function (datasetUri, datasetVar,
    location, comment) {
    var dateTime = new Date();
    var ttl = '@prefix chnode: <http://localhost/> .' +
        '@prefix charme: <http://purl.org/voc/charme#> .' +
        '@prefix oa: <http://www.w3.org/ns/oa#> .' +
        '@prefix prov: <http://www.w3.org/ns/prov#> .' +
        '@prefix xsd: <http://www.w3.org/2001/XML-Schema#> .' +
        '@prefix geo: <http://www.opengis.net/ont/geosparql#> .' +
        '@prefix cnt: <http://www.w3.org/2011/content#> .' +
        '@prefix dc: <http://purl.org/dc/elements/1.1/> .' +
        '@prefix dctypes: <http://purl.org/dc/dcmitype/> .' +
        '<chnode:annoID> a oa:Annotation ;' +
        '    oa:annotatedAt "' + dateTime.toISOString() + '" ;' +
        '    oa:hasTarget <chnode:targetID> ;' +
        '    oa:hasBody <chnode:bodyID> ;' +
        '    oa:motivatedBy oa:linking .' +
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