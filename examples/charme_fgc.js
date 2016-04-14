document.addEventListener('DOMContentLoaded', function () {
    // Set up map
    var layer1 = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data &copy; <a href="http://www.osm.org">OpenStreetMap</a>',
        maxZoom: 18
    });
    var map = L.map('map', {
        layers: [layer1],
        center: [40, 0],
        zoom: 3
    });

    // Define the URL of the CHARMe node to use
    var charmeUrl = 'http://192.168.56.102/';
    // Define the client ID which has been registered on the CHARMe node.
    // The Client on the CHARMe node must have a redirect URL which leads back to this page
    var charmeClientId = 'e6c205f28f25a9f11b71';

    // Create the CHARMe annotator with the given CHARMe node, client ID, and map object
    var annotator = new CharmeAnnotator(charmeUrl, charmeClientId, map);

    // Set the function to call after a successful login
    annotator.setLoggedInCallback(function (userdetails) {
        document.getElementById('greeting').innerHTML = 'Logged in as user ' + userdetails['username'] + '(' + userdetails['first_name'] + ' ' + userdetails['last_name'] + ')';

        document.getElementById('loginButton').disabled = true;
        document.getElementById('logoutButton').disabled = false;
    });

    // Set the function to call after a logout
    annotator.setLoggedOutCallback(function () {
        document.getElementById('greeting').innerHTML = 'Please login to add annotations';
        document.getElementById('loginButton').disabled = false;
        document.getElementById('logoutButton').disabled = true;
    });

    // Bind the toggleAnnotations() function to the button, and change the button label
    document.getElementById('toggleAnnotationsButton').addEventListener('click', function () {
        annotator.toggleAnnotations();
        if (annotator.isAnnotationsOn()) {
            document.getElementById('toggleAnnotationsButton').innerHTML = 'Hide annotations';
        } else {
            document.getElementById('toggleAnnotationsButton').innerHTML = 'Show annotations';
        }
    });

    // Bind the login function to the correct button
    document.getElementById('loginButton').addEventListener('click', function () {
        annotator.charmeLogin();
    });

    // Bind the logout function to the correct button
    document.getElementById('logoutButton').addEventListener('click', function () {
        annotator.charmeLogout();
    });

    // Set some fake dataset details.  In a full demo, this will get called whenever the dataset or variable change
    annotator.setDatasetDetails('http://dataset/uri', 'selectedVar');
});