# leaflet-charme

A [Leaflet](http://leafletjs.com/) plugin for viewing annotations and adding annotations to datasets using the [CHARMe](http://www.charme.org.uk/) system.  Currently it supports the addition of annotations applying to polygonal regions or discrete points of data at a single time value.  Annotations apply to a specific dataset/variable combination.

This plugin does not handle the visualisation of a dataset (which should be handled by a separate library), just the retrieval/submission of annotations associated with it.

## Example

```js
var map = L.map('map')
L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>'
}).addTo(map)

var LayerFactory = L.coverage.LayerFactory()

// Define the URL of the CHARMe node to use
var charmeUrl = 'http://...';

// Define the client ID which has been registered on the CHARMe node.
// The Client on the CHARMe node must have a redirect URL which leads back to this page
var charmeClientId = '0123456789abcdef';

// Create the CHARMe annotator with the given CHARMe node, client ID, and map object
var annotator = new CharmeAnnotator(charmeUrl, charmeClientId, map);

// Display data and retrieve URI + variable name using another library
var datasetUri = ... 
var variableName = ...
// Pass the dataset details to the annotator
annotator.setDatasetDetails(datasetUri, variable);

// Set the function to call after a successful login
annotator.on('login', function (userdetails) {
    console.log('Logged in as user ' + userdetails['username'] + '(' + userdetails['first_name'] + ' ' + userdetails['last_name'] + ')');
});
// Set the function to call after a successful logout
annotator.on('logout', function (userdetails) {
    console.log('Logged out.');
});

// Bind the toggleAnnotations() function to a button
document.getElementById('toggleAnnotationsButton').addEventListener('click', function () {
    annotator.toggleAnnotations();
});

// Bind the login function to a button
document.getElementById('loginButton').addEventListener('click', function () {
    annotator.charmeLogin();
});

// Bind the logout function to a button
document.getElementById('logoutButton').addEventListener('click', function () {
    annotator.charmeLogout();
});
```

## Acknowledgments

This library is developed within the [MELODIES project](http://www.melodiesproject.eu).
