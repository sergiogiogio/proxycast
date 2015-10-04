rm -rf proxycast_sender.js
git clone https://github.com/sergiogiogio/proxycast_sender.js.git
rm -rf CastVideos-chrome
git clone https://github.com/googlecast/CastVideos-chrome.git
sed -i -e "s/https:\/\/www.gstatic.com\/cv\/js\/sender\/v1\/cast_sender.js/\/proxycast_sender.js\/proxycast_sender.js/" CastVideos-chrome/index.html
sed -i -e "s/'4F8B3483'/chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID/" CastVideos-chrome/CastVideos.js

echo "$(tput setaf 2)Ready, start the server and point your web browser to http://$(hostname):port/CastVideos-chrome/index.html$(tput sgr0)"
