/**
 * WebServer.js
 * Vn: 0.1.1 2024-12-05
 * (C)2024 C-Born Software Systems
 * DAV
 *
 * Implements a simple web server for OpenPnP
 * This initial version is designed to connect from your phone's browser so you can easily move the nozzles
 * up and down from the machine, so you don't have to reach blindly out for the PC keyboard.
 * It could be easily extended to provide any other control functions, and to display status information, etc.
 * Port number is arbitrary - I wrote a simple UDP based version with an Android connecting app (Flutter) earlier today on port 4444 so used the next one
 *
 * For testing you can edit the script and call it again from inside OpenPnP, it will kill the previous version and replace it
 * The "Exit" button does the same thing, you will need to rerun the script if you press it! 
 */

var InetSocketAddress = Java.type("java.net.InetSocketAddress");
var HttpServer = Java.type("com.sun.net.httpserver.HttpServer");
var HttpHandler = Java.type("com.sun.net.httpserver.HttpHandler");

var LengthUnit = Java.type("org.openpnp.model.LengthUnit");
var Location = Java.type("org.openpnp.model.Location");
var submitUiMachineTask = Java.type("org.openpnp.util.UiUtils").submitUiMachineTask;

var port = 4445;	// Set this to the port you want to listen on
var server = null;

// Function to start the HTTP server
function startServer() {
    try {
        server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/", new FileHandler()); // Serve the web interface
        server.createContext("/send", new CommandHandler()); // Handle commands
        server.start();

        print("HTTP Server running at http://0.0.0.0:" + port);
    } catch (e) {
        print("Error starting server: " + e);
    }
}

// Function to stop the HTTP server
function stopServer() {
    if (server != null) {
        server.stop(0); // Stop immediately
        print("HTTP Server stopped.");
    }
}

// Function to move the nozzle by a specified amount
function moveNozzle(amount) {
    try {
        var nozzle = machine.defaultHead.defaultNozzle;
        if (nozzle == null) {
            print("Error: No default nozzle configured.");
            return;
        }

        var location = nozzle.location;
        if (location == null) {
            print("Error: Unable to get nozzle location.");
            return;
        }

        print("Current Location: " + location.toString());

        // Move the nozzle
        var newLocation = location.add(new Location(LengthUnit.Millimeters, 0, 0, amount, 0));
        print("Moving to New Location: " + newLocation.toString());
        nozzle.moveTo(newLocation);
    } catch (e) {
        print("Error in moveNozzle: " + e);
    }
}

// Process machine commands
function processCommand(command) {
    if (command === "exit") {
        print("Exit command received. Stopping server...");
        stopServer();
    } else {
        var parts = command.split(" ");
        var baseCommand = parts[0].toLowerCase();
        var parameter = parseFloat(parts[1]);

        if (baseCommand === "raise") {
            print("Raising nozzle by " + parameter + "mm");
            moveNozzle(parameter);
        } else if (baseCommand === "lower") {
            print("Lowering nozzle by " + parameter + "mm");
            moveNozzle(-parameter);
        } else {
            print("Unknown command: " + command);
        }
    }
}

// Command handler
var CommandHandler = Java.extend(HttpHandler, {
    handle: function(exchange) {
        var uri = exchange.getRequestURI();
        var query = uri.getQuery();
        var response;

        if (uri.getPath() === "/send" && query) {
            var command = query.split("=")[1];
            processCommand(command);
            response = "Command processed: " + command;
        } else {
            response = "Invalid endpoint or no command provided.";
        }

        exchange.sendResponseHeaders(200, response.length());
        var os = exchange.getResponseBody();
        os.write(response.getBytes());
        os.close();
    }
});

// Mobile-friendly HTML interface (with concatenation)
var html = ""
    + "<!DOCTYPE html>"
    + "<html>"
    + "<head>"
    + "    <title>OpenPnP Control</title>"
    + "    <style>"
    + "        body {"
    + "            font-family: Arial, sans-serif;"
    + "            margin: 0;"
    + "            padding: 0;"
    + "            height: 100vh;"
    + "            display: flex;"
    + "            flex-direction: column;"
    + "            justify-content: space-between;"
    + "            background-color: #f0f0f0;"
    + "        }"
    + "        h1 {"
    + "            margin: 0;"
    + "            padding: 10px;"
    + "            font-size: 48px;"
    + "            background-color: #007BFF;"
    + "            color: white;"
    + "            text-align: center;"
    + "        }"
    + "        .container {"
    + "            flex: 1;"
    + "            display: flex;"
    + "            justify-content: space-between;"
    + "            align-items: stretch;"
    + "            padding: 10px;"
    + "        }"
    + "        .column {"
    + "            display: flex;"
    + "            flex-direction: column;"
    + "            justify-content: space-between;"
    + "            align-items: center;"
    + "            width: 48%;"
    + "        }"
    + "        button {"
    + "            font-size: 44px;"
    + "            padding: 15px;"
    + "            margin: 5px 0;"
    + "            width: 100%;"
    + "            height: 30%;"
    + "            border: none;"
    + "            border-radius: 12px;"
    + "            cursor: pointer;"
    + "            background-color: #007BFF;"
    + "            color: white;"
    + "        }"
    + "        button:active {"
    + "            background-color: #0056b3;"
    + "        }"
    + "        .exit-button {"
    + "            font-size: 40px;"
    + "            padding: 15px;"
    + "            width: 100%;"
    + "            height: 10%;"
    + "            background-color: #FF4136;"
    + "            color: white;"
    + "            border: none;"
    + "            cursor: pointer;"
    + "        }"
    + "        .exit-button:active {"
    + "            background-color: #cc3227;"
    + "        }"
    + "    </style>"
    + "    <script>"
    + "        function sendCommand(command) {"
    + "            fetch('/send?command=' + encodeURIComponent(command))"
    + "                .then(response => response.text())"
    + "                .then(data => console.log(data))"
    + "                .catch(error => console.error(error));"
    + "        }"
    + "    </script>"
    + "</head>"
    + "<body>"
    + "    <h1>OpenPnP Nozzle Control 0.1.1</h1> "
    + "    <div class='container'>"
    + "        <div class='column'>"
    + "            <button onclick=\"sendCommand('raise 1.0')\">Raise 1mm</button>"
    + "            <button onclick=\"sendCommand('raise 0.1')\">Raise 0.1mm</button>"
    + "            <button onclick=\"sendCommand('raise 0.01')\">Raise 0.01mm</button>"
    + "        </div>"
    + "        <div class='column'>"
    + "            <button onclick=\"sendCommand('lower 1.0')\">Lower 1mm</button>"
    + "            <button onclick=\"sendCommand('lower 0.1')\">Lower 0.1mm</button>"
    + "            <button onclick=\"sendCommand('lower 0.01')\">Lower 0.01mm</button>"
    + "        </div>"
    + "    </div>"
    + "    <button class='exit-button' onclick=\"sendCommand('exit')\">EXIT</button>"
    + "</body>"
    + "</html>";


// Static file handler
var FileHandler = Java.extend(HttpHandler, {
    handle: function(exchange) {
        var response = html;
        exchange.sendResponseHeaders(200, response.length());
        var os = exchange.getResponseBody();
        os.write(response.getBytes());
        os.close();
    }
});

// Send "exit" to the previous server before starting a new one
try {
    var URL = Java.type("java.net.URL");
    var url = new URL("http://localhost:" + port + "/send?command=exit");
    url.openStream().close(); // Send the exit command
    print("Exit command sent to the previous server.");
    java.lang.Thread.sleep(500); // Wait for the server to stop
} catch (e) {
    print("No previous server found or failed to connect: " + e);
}

// Start the new server
startServer();
