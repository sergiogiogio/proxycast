# proxycast

A proxy giving any device access to control a chromecast (not just the devices for which there is an API).
The proxy receives commands via HTTP and forwards them to the chromecast via the appropriate protocol.

Coupled with [proxycast_sender.js](https://github.com/sergiogiogio/proxycast_sender.js), the proxy can run all chromecast webapps from any browser (not just chrome) without the need for a plugin. 

# Example
The [CastVideos-chrome](https://github.com/googlecast/CastVideos-chrome) reference example requires chrome and the chromecast plugin.
The proxy makes it possible to run the example from any browser, by simply changing in the html files the link to the official chromecast API cast_sender.js (which uses the plugin), to a link to [proxycast_sender.js](https://github.com/sergiogiogio/proxycast_sender.js) which exposes the same API but uses the proxy.

Internet Explorer | Android Internet | iOS Safari
--- | --- | ---
![](https://raw.githubusercontent.com/sergiogiogio/proxycast/master/screenshots/proxycast-ie.png) | ![](https://raw.githubusercontent.com/sergiogiogio/proxycast/master/screenshots/proxycast-android.png) | ![](https://raw.githubusercontent.com/sergiogiogio/proxycast/master/screenshots/proxycast-ios.png)

# Installation

The below command installs the proxy as a module available to be used as part of a webserver
```
npm install proxycast
```

To run the CastVideos-chrome example mentioned above:
 1. Run the below commands
```
cd node_modules/proxycast/examples
# the below command downloads CastVideos-chrome and proxycast_sender.js and makes the necessary update to use the proxy instead of the plugin
./add-CastVideos-chrome.sh
# the below command opens the proxy as part of a simple webserver
node server.js
```
 2. Open http://hostname:8090/CastVideos-chrome/index.html on any browser


# Objective
The objective is to hopefully consolidate development efforts on a single API (the chrome api).
The CastVideos-chrome reference example can be the starting point of a chromecast based media player accessible from all devices.
