const staticRadioPlayer = "radio-player-site-v1"
const assets = [
  "/",
  "/index.html",
  "/js.js",
  "/regist_ServiceWorker.js",
  "/manifest.json",
  "/radio.png",
  "/radio2.png",
]

self.addEventListener("install", installEvent => {
  installEvent.waitUntil(
    caches.open(staticRadioPlayer).then(cache => {
      cache.addAll(assets)
    })
  )
})

self.addEventListener("fetch", fetchEvent => {
    fetchEvent.respondWith(
      caches.match(fetchEvent.request).then(res => {
        return res || fetch(fetchEvent.request)
      })
    )
  })