$(document).ready(function(){

    var swalBackground = "#333333"
    var swalColor = "#FF9966"
    var swalConfirmButtonColor = "#424242"

    $("#btn-frase").click(function(){
        fetch('txt.txt')
        .then(res => res.text())
        .then(content => {
            let lines = content.split(/\n/)
            Swal.fire({
                title: lines[Math.floor(Math.random() * lines.length)].toString(),
                color: swalColor,
                background: swalBackground,
                confirmButtonColor: "#4CAF50",
                confirmButtonText: "Gracias!"
            })
        })
    })

    /* Cotización del dólar en vivo
       - Banco Nación (oficial): DolarApi, que toma el dato de BNA (respaldo: ComparaDólar)
       - Ualá y Brubank: ComparaDólar, actualizado desde cada entidad
       - Dólar MEP: DolarApi (bolsa)
       Se consulta sin caché al abrir y se refresca cada 60 s mientras la ventana está abierta. */
    const FX_REFRESH = 60000
    const FX_URL = {
        entidades: "https://api.comparadolar.ar/usd",
        oficial: "https://dolarapi.com/v1/dolares/oficial",
        mep: "https://dolarapi.com/v1/dolares/bolsa"
    }
    const fxMoney = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2, maximumFractionDigits: 2 })

    function fxJSON(url){
        return fetch(url, { cache: "no-store" }).then(res => {
            if (!res.ok) throw new Error("HTTP " + res.status)
            return res.json()
        })
    }

    function fxEsc(text){
        return String(text == null ? "" : text).replace(/[&<>"']/g, c =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])
    }

    function fxWhen(iso){
        if (!iso) return ""
        const d = new Date(iso)
        if (isNaN(d)) return ""
        const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })
        return d.toDateString() === new Date().toDateString()
            ? "hoy " + hora
            : d.toLocaleDateString("es-AR", { weekday: "short", day: "2-digit", month: "2-digit" }) + " " + hora
    }

    function fxRow(item){
        const val = v => (typeof v === "number" && isFinite(v)) ? fxMoney.format(v) : "—"
        const logo = item.logo
            ? '<img src="' + fxEsc(item.logo) + '" alt="" loading="lazy">'
            : '<span class="fx-logo-txt">' + fxEsc(item.logoTxt || item.nombre.slice(0, 1)) + '</span>'
        let meta = []
        if (item.cuando) meta.push("Act. " + fxEsc(item.cuando))
        if (item.nota) meta.push(fxEsc(item.nota))
        let varHtml = ""
        if (typeof item.variacion === "number" && isFinite(item.variacion)) {
            const cls = item.variacion > 0 ? "up" : item.variacion < 0 ? "down" : "flat"
            const sig = item.variacion > 0 ? "▲" : item.variacion < 0 ? "▼" : "•"
            varHtml = '<span class="fx-var ' + cls + '">' + sig + " " + Math.abs(item.variacion).toFixed(2).replace(".", ",") + "%</span>"
        }
        if (item.error) {
            return '<div class="fx-row is-error"><div class="fx-name"><span class="fx-logo">' + logo + '</span><span><b>' +
                fxEsc(item.nombre) + '</b><small>No disponible en este momento</small></span></div></div>'
        }
        return '<div class="fx-row">' +
            '<div class="fx-name"><span class="fx-logo">' + logo + '</span><span><b>' + fxEsc(item.nombre) + "</b>" +
            (meta.length ? "<small>" + meta.join(" · ") + "</small>" : "") + "</span></div>" +
            '<div class="fx-val"><small>Compra</small><b>' + val(item.compra) + "</b></div>" +
            '<div class="fx-val"><small>Venta</small><b>' + val(item.venta) + "</b>" + varHtml + "</div>" +
            "</div>"
    }

    function fxLoad(){
        return Promise.allSettled([fxJSON(FX_URL.entidades), fxJSON(FX_URL.oficial), fxJSON(FX_URL.mep)])
            .then(([ent, ofi, mep]) => {
                const lista = ent.status === "fulfilled" && Array.isArray(ent.value) ? ent.value : []
                const de = slug => lista.find(e => e.slug === slug)
                const desdeEntidad = (e, nombre) => e
                    ? { nombre, logo: e.logoUrl, compra: e.bid, venta: e.ask, variacion: e.pct_variation, nota: e.conditions || "" }
                    : { nombre, error: true }

                const bnaAlt = de("banco-nacion")
                let bna
                if (ofi.status === "fulfilled" && ofi.value && typeof ofi.value.venta === "number") {
                    bna = { nombre: "Banco Nación", logo: bnaAlt && bnaAlt.logoUrl, compra: ofi.value.compra, venta: ofi.value.venta,
                            variacion: bnaAlt && bnaAlt.pct_variation, cuando: fxWhen(ofi.value.fechaActualizacion) }
                } else {
                    bna = desdeEntidad(bnaAlt, "Banco Nación")
                }

                const bru = de("brubank-ultra") || de("brubank")
                const brubank = desdeEntidad(bru, "Brubank")
                if (bru && /ultra/i.test(bru.conditions || bru.slug)) brubank.nota = "Precio para clientes Ultra"

                const mepItem = (mep.status === "fulfilled" && mep.value && typeof mep.value.venta === "number")
                    ? { nombre: "Dólar MEP", logoTxt: "$", compra: mep.value.compra, venta: mep.value.venta, cuando: fxWhen(mep.value.fechaActualizacion), nota: "Mercado (bonos)" }
                    : { nombre: "Dólar MEP", error: true }

                return { oficial: [bna, desdeEntidad(de("uala"), "Ualá"), brubank], mep: [mepItem] }
            })
    }

    function fxRender(box, data){
        box.querySelector(".fx-oficial").innerHTML = data.oficial.map(fxRow).join("")
        box.querySelector(".fx-mep").innerHTML = data.mep.map(fxRow).join("")
    }

    $("#btn-cotizacion").click(function(){
        let timer = null, ticker = null, last = 0, box = null

        function refrescar(){
            if (!box) return
            box.classList.add("is-loading")
            fxLoad().then(data => {
                if (!box) return
                fxRender(box, data)
                last = Date.now()
                box.classList.remove("is-loading")
                tick()
            })
        }
        function tick(){
            if (!box || !last) return
            const seg = Math.round((Date.now() - last) / 1000)
            box.querySelector(".fx-updated").textContent =
                seg < 5 ? "Actualizado recién" : "Actualizado hace " + (seg < 60 ? seg + " s" : Math.floor(seg / 60) + " min")
        }

        const skeleton = '<div class="fx-row fx-skel"></div>'
        Swal.fire({
            html:
                '<div class="fx">' +
                  '<div class="fx-head"><h3>Cotización del dólar</h3>' +
                    '<button type="button" class="fx-refresh" title="Actualizar ahora" aria-label="Actualizar ahora">' +
                    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>' +
                    '</button></div>' +
                  '<p class="fx-sec">Dólar oficial</p><div class="fx-oficial">' + skeleton.repeat(3) + '</div>' +
                  '<p class="fx-sec">Dólar MEP</p><div class="fx-mep">' + skeleton + '</div>' +
                  '<p class="fx-foot"><span class="fx-updated">Consultando…</span> · se actualiza cada minuto<br>' +
                  'Fuentes: <a href="https://dolarapi.com" target="_blank" rel="noopener">DolarApi</a> (BNA, MEP) y ' +
                  '<a href="https://comparadolar.ar" target="_blank" rel="noopener">ComparaDólar</a> (Ualá, Brubank)</p>' +
                '</div>',
            background: swalBackground,
            customClass: { popup: "fx-popup" },
            confirmButtonColor: "#4CAF50",
            confirmButtonText: "OK",
            didOpen: popup => {
                box = popup.querySelector(".fx")
                box.querySelector(".fx-refresh").addEventListener("click", refrescar)
                refrescar()
                timer = setInterval(refrescar, FX_REFRESH)
                ticker = setInterval(tick, 1000)
            },
            willClose: () => {
                clearInterval(timer)
                clearInterval(ticker)
                box = null
            }
        })
    })

    var hoverActiveColor = '#FF9999'
    var hoverInactiveColor = ''

    $('li a').hover(function() {
        $(this).css('color', hoverActiveColor).addClass("active")
    }, function() {
        $(this).css('color', hoverInactiveColor).removeClass("active")
    })


    /* TV dinámica */
    $(document).on("click", ".tvBtn", function(){

        const target = $(this).data("target")

        $("#" + target).slideToggle("slow")

        $(this).toggleClass("btn-outline-secondary")
        $(this).toggleClass("btn-secondary")

    })


    /* Switch tema */
    $("#switchLight").change(function(){

        if ($(this).prop("checked") == true) {

            $("#body").css({'background-color':'#F5F5F5'})
            $("[name=titulo]").css({'color':'#d71414'})
            $(".offcanvas-body").css({'background-color':'#F5F5F5'})
            swalBackground = "#F5F5F5"
            swalColor = "#FF0000"

        } else {

            $("#body").css({'background-color':'#16161d'})
            $("[name=titulo]").css({'color':'#FF9999'})
            $(".offcanvas-body").css({'background-color':'#16161d'})
            swalBackground = "#333333"
            swalColor = "#FF9966"

        }

    })


    /* PWA install */
    let installPrompt = null
    const installButton = document.querySelector("#install")

    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault()
        installPrompt = event
        installButton.removeAttribute("hidden")
    })

    installButton.addEventListener("click", async () => {
        if (!installPrompt) return

        const result = await installPrompt.prompt()

        console.log(`Install prompt was: ${result.outcome}`)

        installPrompt = null
        installButton.setAttribute("hidden", "")
    })

})

/* =====================================================================
   Mejoras visuales: escenario de TV en grilla y reproductores de radio.
   Bloque independiente: no modifica las funciones ni handlers de arriba,
   solo mejora los elementos que generan loadTV() y loadRadios().
   ===================================================================== */
$(function(){

    const body = document.body
    const navEl = document.getElementById("navbar")
    const section = document.getElementById("tvSection")
    const stage = document.getElementById("tvPlayers")
    const bar = document.getElementById("tvBar")
    if (!stage || !section) return

    const GAP = 6
    const HEAD = 30
    const MIN_FRAC = 0.12

    /* ---------- Tema claro/oscuro (complementa el switch original) y lo recuerda ---------- */
    const THEME_KEY = "rp-theme"
    const themeMeta = document.querySelector('meta[name="theme-color"]')

    function applyTheme(light){
        document.documentElement.classList.toggle("light", light)
        body.setAttribute("data-bs-theme", light ? "light" : "dark")
        if (themeMeta) themeMeta.setAttribute("content", light ? "#f6f3ee" : "#101217")
    }

    $("#switchLight").change(function(){
        const light = $(this).prop("checked") == true
        applyTheme(light)
        try { localStorage.setItem(THEME_KEY, light ? "light" : "dark") } catch (e) {}
    })

    let savedTheme = null
    try { savedTheme = localStorage.getItem(THEME_KEY) } catch (e) {}
    if (savedTheme === "light") {
        // Dispara también el handler original para que aplique sus colores
        $("#switchLight").prop("checked", true).trigger("change")
    } else {
        applyTheme(false)
    }

    /* ---------- Barra fija: se acomoda al navbar que se oculta ---------- */
    function syncBar(){
        const navH = navEl ? navEl.offsetHeight : 56
        const navHidden = navEl && navEl.style.top === "-70px"
        body.style.setProperty("--nav-h", navH + "px")
        body.style.setProperty("--bar-top", navHidden ? "0px" : navH + "px")
        body.style.setProperty("--bar-h", bar.offsetHeight + "px")
    }
    window.addEventListener("scroll", () => requestAnimationFrame(syncBar), { passive: true })
    window.addEventListener("resize", syncBar)
    syncBar()

    /* =====================================================================
       TV: modelo de distribución
       layout = { rows: [ { h: fracción, cells: [ { id, w: fracción } ] } ] }
       Los iframes nunca se mueven en el DOM (eso los recargaría):
       solo se posicionan de forma absoluta dentro del escenario.
       ===================================================================== */
    let order = []
    let layout = null
    let custom = false

    // Forma de dividir: "auto" (grilla), "cols" (vertical, lado a lado), "rows" (horizontal, apilados)
    const SPLIT_KEY = "rp-tv-split"
    let splitMode = "auto"
    try { splitMode = localStorage.getItem(SPLIT_KEY) || "auto" } catch (e) {}
    if (!["auto", "cols", "rows"].includes(splitMode)) splitMode = "auto"

    function paintSplit(){
        document.querySelectorAll(".seg-btn").forEach(b =>
            b.setAttribute("aria-pressed", b.dataset.split === splitMode ? "true" : "false"))
    }
    paintSplit()

    const handleLayer = document.createElement("div")
    const handles = {}
    const exitBtn = document.createElement("button")
    exitBtn.type = "button"
    exitBtn.className = "tv-exit"
    exitBtn.textContent = "Salir de pantalla completa"
    stage.appendChild(handleLayer)
    stage.appendChild(exitBtn)

    function tileOf(id){ return document.getElementById(id) }
    function btnOf(id){ return document.querySelector('.tvBtn[data-target="' + id + '"]') }

    function bestCounts(n, W, H){
        let best = null
        for (let r = 1; r <= n; r++) {
            const base = Math.floor(n / r), extra = n % r
            const counts = []
            for (let i = 0; i < r; i++) counts.push(base + (i < extra ? 1 : 0))
            const rh = (H - GAP * (r - 1)) / r - HEAD
            if (rh <= 0) continue
            let score = 0
            counts.forEach(k => {
                const cw = (W - GAP * (k - 1)) / k
                const vw = Math.min(cw, rh * 16 / 9)
                score += k * vw * vw * 9 / 16
            })
            if (!best || score > best.score * 1.001) best = { score, counts }
        }
        return best ? best.counts : [n]
    }

    function buildLayout(){
        if (!order.length) { layout = null; return }
        const { W, H } = innerSize()
        const n = order.length
        const counts = splitMode === "cols" ? [n]
                     : splitMode === "rows" ? Array(n).fill(1)
                     : bestCounts(n, W || window.innerWidth, H || window.innerHeight)
        let i = 0
        layout = {
            rows: counts.map(k => ({
                h: 1 / counts.length,
                cells: Array.from({ length: k }, () => ({ id: order[i++], w: 1 / k }))
            }))
        }
        custom = false
    }

    function innerSize(){
        const pad = parseFloat(getComputedStyle(stage).paddingLeft) || 0
        return { W: stage.clientWidth - pad * 2, H: stage.clientHeight - pad * 2, pad }
    }

    function getHandle(key, type, ri, ci){
        let h = handles[key]
        if (!h) {
            h = document.createElement("div")
            h.className = "tv-handle " + type
            h.addEventListener("pointerdown", e => startResize(e, h))
            h.addEventListener("dblclick", () => equalizePair(h))
            handleLayer.appendChild(h)
            handles[key] = h
        }
        h.dataset.type = type
        h.dataset.ri = ri
        h.dataset.ci = ci
        h.dataset.used = "1"
        return h
    }

    function render(){
        Object.values(handles).forEach(h => h.dataset.used = "")
        if (layout) {
            const { W, H, pad } = innerSize()
            const rows = layout.rows
            const availH = H - GAP * (rows.length - 1)
            let y = pad
            rows.forEach((row, ri) => {
                const rh = row.h * availH
                const availW = W - GAP * (row.cells.length - 1)
                let x = pad
                row.cells.forEach((cell, ci) => {
                    const cw = cell.w * availW
                    const el = tileOf(cell.id)
                    if (el) Object.assign(el.style, { left: x + "px", top: y + "px", width: cw + "px", height: rh + "px" })
                    x += cw
                    if (ci < row.cells.length - 1) {
                        Object.assign(getHandle("v" + ri + "-" + ci, "v", ri, ci).style,
                            { left: (x - 5) + "px", top: y + "px", width: (GAP + 10) + "px", height: rh + "px" })
                    }
                    x += GAP
                })
                y += rh
                if (ri < rows.length - 1) {
                    Object.assign(getHandle("h" + ri, "h", ri, -1).style,
                        { left: pad + "px", top: (y - 5) + "px", width: W + "px", height: (GAP + 10) + "px" })
                }
                y += GAP
            })
        }
        Object.keys(handles).forEach(k => {
            if (!handles[k].dataset.used) { handles[k].remove(); delete handles[k] }
        })
    }

    /* ---------- Redimensionar arrastrando los bordes ---------- */
    function pairOf(h){
        const ri = +h.dataset.ri, ci = +h.dataset.ci
        if (h.dataset.type === "h") {
            return { a: layout.rows[ri], b: layout.rows[ri + 1], key: "h",
                     avail: innerSize().H - GAP * (layout.rows.length - 1) }
        }
        const row = layout.rows[ri]
        return { a: row.cells[ci], b: row.cells[ci + 1], key: "w",
                 avail: innerSize().W - GAP * (row.cells.length - 1) }
    }

    function startResize(e, h){
        if (!layout) return
        e.preventDefault()
        const p = pairOf(h)
        const total = p.a[p.key] + p.b[p.key]
        const startA = p.a[p.key]
        const start = h.dataset.type === "h" ? e.clientY : e.clientX
        h.setPointerCapture(e.pointerId)
        h.classList.add("active")
        stage.classList.add("is-dragging")

        function move(ev){
            const pos = h.dataset.type === "h" ? ev.clientY : ev.clientX
            const na = Math.min(Math.max(startA + (pos - start) / p.avail, MIN_FRAC), total - MIN_FRAC)
            p.a[p.key] = na
            p.b[p.key] = total - na
            custom = true
            render()
        }
        function up(){
            h.classList.remove("active")
            stage.classList.remove("is-dragging")
            h.removeEventListener("pointermove", move)
            h.removeEventListener("pointerup", up)
            h.removeEventListener("pointercancel", up)
        }
        h.addEventListener("pointermove", move)
        h.addEventListener("pointerup", up)
        h.addEventListener("pointercancel", up)
    }

    function equalizePair(h){
        if (!layout) return
        const p = pairOf(h)
        const half = (p.a[p.key] + p.b[p.key]) / 2
        p.a[p.key] = half
        p.b[p.key] = half
        render()
    }

    /* ---------- Intercambiar canales arrastrando la barra de título ---------- */
    function swapIds(a, b){
        layout.rows.forEach(row => row.cells.forEach(c => {
            if (c.id === a) c.id = b
            else if (c.id === b) c.id = a
        }))
        const ia = order.indexOf(a), ib = order.indexOf(b)
        order[ia] = b
        order[ib] = a
        render()
    }

    function startSwap(e, tile){
        if (e.target.closest("button") || order.length < 2) return
        e.preventDefault()
        const head = e.currentTarget
        const sx = e.clientX, sy = e.clientY
        let ghost = null, target = null
        head.setPointerCapture(e.pointerId)

        function move(ev){
            if (!ghost) {
                if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 8) return
                ghost = document.createElement("div")
                ghost.className = "tv-ghost"
                ghost.textContent = "⇄ " + tile.querySelector(".tv-name").textContent
                document.body.appendChild(ghost)
                tile.classList.add("swap-source")
                stage.classList.add("is-dragging")
            }
            ghost.style.left = ev.clientX + "px"
            ghost.style.top = ev.clientY + "px"
            let found = null
            order.forEach(id => {
                const t = tileOf(id)
                if (t === tile) return
                const r = t.getBoundingClientRect()
                if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) found = t
            })
            if (found !== target) {
                if (target) target.classList.remove("swap-target")
                target = found
                if (target) target.classList.add("swap-target")
            }
        }
        function up(){
            head.removeEventListener("pointermove", move)
            head.removeEventListener("pointerup", up)
            head.removeEventListener("pointercancel", up)
            if (ghost) ghost.remove()
            tile.classList.remove("swap-source")
            stage.classList.remove("is-dragging")
            if (target) {
                target.classList.remove("swap-target")
                swapIds(tile.id, target.id)
            }
        }
        head.addEventListener("pointermove", move)
        head.addEventListener("pointerup", up)
        head.addEventListener("pointercancel", up)
    }

    /* ---------- Barra de título de cada canal ---------- */
    function enhanceTile(tile){
        if (tile.dataset.enhanced) return
        tile.dataset.enhanced = "1"
        const iframe = tile.querySelector("iframe")
        const name = iframe ? iframe.title : tile.id

        const head = document.createElement("div")
        head.className = "tv-head"
        head.title = "Arrastrá para intercambiar de lugar"
        head.innerHTML =
            '<span class="tv-grip">⠿</span>' +
            '<span class="tv-name"></span>' +
            '<span class="tv-live">EN VIVO</span>' +
            (document.fullscreenEnabled
                ? '<button type="button" data-act="fs" title="Pantalla completa" aria-label="Pantalla completa">' +
                  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>'
                : '') +
            '<button type="button" data-act="close" title="Cerrar" aria-label="Cerrar">' +
            '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
        head.querySelector(".tv-name").textContent = name
        tile.insertBefore(head, tile.firstChild)

        head.addEventListener("pointerdown", e => startSwap(e, tile))
        head.addEventListener("click", e => {
            const btn = e.target.closest("button")
            if (!btn) return
            if (btn.dataset.act === "close") $(btnOf(tile.id)).trigger("click")
            if (btn.dataset.act === "fs" && iframe && iframe.requestFullscreen) iframe.requestFullscreen()
        })
        head.addEventListener("dblclick", e => {
            if (!e.target.closest("button") && iframe && iframe.requestFullscreen) iframe.requestFullscreen()
        })
    }

    /* ---------- Sincronizar con los botones (estado del handler original) ---------- */
    function sync(){
        const active = Array.from(document.querySelectorAll(".tvBtn.btn-secondary")).map(b => b.dataset.target)
        const added = active.filter(id => !order.includes(id))
        const changed = added.length || order.some(id => !active.includes(id))
        order = order.filter(id => active.includes(id)).concat(added)

        document.querySelectorAll("#tvPlayers > .tvPlayer").forEach(t => {
            $(t).stop(true, true)
            t.style.display = order.includes(t.id) ? "block" : "none"
        })

        section.classList.toggle("has-tiles", order.length > 0)
        const count = document.getElementById("tvCount")
        if (count) count.textContent = order.length > 1 ? order.length + " en pantalla" : ""
        if (!order.length) exitCinema()

        syncBar()
        if (changed) buildLayout()
        render()
        return added.length > 0
    }

    function revealStage(){
        const r = stage.getBoundingClientRect()
        if (r.bottom > window.innerHeight || r.top < bar.offsetHeight) {
            window.scrollTo({ top: window.scrollY + r.bottom - window.innerHeight + 8, behavior: "smooth" })
        }
    }

    $(document).on("click", ".tvBtn", function(){
        setTimeout(() => { if (sync()) revealStage() }, 0)
    })

    /* ---------- Herramientas ---------- */
    $("#tvEqualize").on("click", () => { buildLayout(); render() })

    $(".seg-btn").on("click", function(){
        splitMode = this.dataset.split
        try { localStorage.setItem(SPLIT_KEY, splitMode) } catch (e) {}
        paintSplit()
        buildLayout()
        render()
    })

    $("#tvCloseAll").on("click", () => {
        order.slice().forEach(id => $(btnOf(id)).trigger("click"))
    })

    function exitCinema(){
        if (document.fullscreenElement === stage) document.exitFullscreen()
        stage.classList.remove("cinema")
        body.style.overflow = ""
    }

    $("#tvFullscreen").on("click", () => {
        if (stage.requestFullscreen && document.fullscreenEnabled) {
            stage.requestFullscreen()
        } else {
            stage.classList.add("cinema")
            body.style.overflow = "hidden"
        }
    })
    exitBtn.addEventListener("click", exitCinema)
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && stage.classList.contains("cinema")) exitCinema()
    })

    /* ---------- Reacomodar al cambiar el tamaño del escenario ---------- */
    if (window.ResizeObserver) {
        new ResizeObserver(() => {
            if (!custom && order.length) buildLayout()
            render()
        }).observe(stage)
        new ResizeObserver(syncBar).observe(bar)
    } else {
        window.addEventListener("resize", () => { if (!custom) buildLayout(); render() })
    }

    /* =====================================================================
       Radios: tarjetas con controles propios sobre el <audio> original
       ===================================================================== */
    const ICON_PLAY  = '<svg class="ic-play" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>'
    const ICON_PAUSE = '<svg class="ic-pause" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>'
    const ICON_SPIN  = '<svg class="ic-spin" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M12 3a9 9 0 1 0 9 9"/></svg>'
    const ICON_VOL   = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>'

    // Espera generosa: hay servidores que tardan varios segundos en entregar el primer audio
    const CONNECT_TIMEOUT = 45000          // ms por intento sin recibir audio reproducible
    const RETRY_DELAYS = [2000, 4000, 8000] // pausas entre reintentos ante un error real
    const MAX_ATTEMPTS = RETRY_DELAYS.length + 1

    function fmtTime(ms){
        const t = Math.max(0, Math.round(ms / 1000))
        return Math.floor(t / 60) + ":" + String(t % 60).padStart(2, "0")
    }

    function hueOf(text){
        let h = 0
        for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 360
        return h
    }

    const radioTicks = new Set()
    setInterval(() => radioTicks.forEach(fn => fn()), 1000)

    function enhanceRadio(card){
        if (card.dataset.enhanced) return
        const audio = card.querySelector("audio")
        const title = card.querySelector("[name=titulo]")
        if (!audio || !title) return
        card.dataset.enhanced = "1"

        const name = title.textContent.trim()
        const initials = name.replace(/[^\p{L}\p{N} ]/gu, "").split(/\s+/).filter(Boolean)
            .slice(0, 2).map(w => w[0]).join("").toUpperCase() || "♪"

        card.classList.add("radio-card")
        card.style.setProperty("--hue", hueOf(name))
        audio.removeAttribute("controls")
        audio.preload = "none"

        const art = document.createElement("div")
        art.className = "rc-art"
        art.innerHTML = '<span class="rc-initials"></span><span class="rc-eq"><i></i><i></i><i></i><i></i></span>'
        art.querySelector(".rc-initials").textContent = initials

        const info = document.createElement("div")
        info.className = "rc-info"
        const status = document.createElement("div")
        status.className = "rc-status"
        info.appendChild(title)
        info.appendChild(status)

        const play = document.createElement("button")
        play.type = "button"
        play.className = "rc-play"
        play.innerHTML = ICON_PLAY + ICON_PAUSE + ICON_SPIN

        const vol = document.createElement("label")
        vol.className = "rc-vol"
        vol.innerHTML = ICON_VOL + '<input type="range" min="0" max="1" step="0.01" value="1" aria-label="Volumen ' + name.replace(/"/g, "") + '">'
        const range = vol.querySelector("input")

        card.insertBefore(art, card.firstChild)
        card.insertBefore(info, art.nextSibling)
        card.insertBefore(play, info.nextSibling)
        card.insertBefore(vol, play.nextSibling)

        /*
          wanted:     lo que pidió el usuario ("stop" | "play" | "pause")
          hasSession: hay una conexión viva con audio ya recibido. Mientras exista,
                      la pausa NO corta la descarga: el navegador sigue guardando la
                      transmisión y al dar play continúa desde donde se pausó.
                      Solo al recargar la página (o si el servidor corta) se vuelve al vivo.
        */
        let wanted = "stop"
        let hasSession = false
        let token = 0
        let attempts = 0
        let firstStart = 0
        let pausedAt = 0
        let pausedTotal = 0
        let watchdog = null
        let retryTimer = null
        let retryPending = false

        function clearTimers(){
            clearTimeout(watchdog)
            clearTimeout(retryTimer)
        }

        function setState(s){
            card.dataset.state = s
            play.setAttribute("aria-label", (s === "playing" || s === "loading" ? "Pausar " : "Reproducir ") + name)
            tick()
        }

        function tick(){
            const s = card.dataset.state
            let text = ""
            if (s === "idle") text = "Detenida"
            else if (s === "error") text = "Sin señal · tocá ▶"
            else if (s === "loading") {
                text = hasSession ? "Cargando…" : "Conectando… " + Math.round((Date.now() - firstStart) / 1000) + " s"
                if (!hasSession && attempts > 1) text += " · intento " + attempts + "/" + MAX_ATTEMPTS
            }
            else if (s === "playing") text = pausedTotal >= 2000 ? "En diferido −" + fmtTime(pausedTotal) : "En vivo"
            else if (s === "paused") text = hasSession
                ? "En pausa · guardando " + fmtTime(Date.now() - pausedAt)
                : "En pausa · se reanudará en vivo"
            if (status.textContent !== text) status.textContent = text
        }
        radioTicks.add(tick)

        // Abre una conexión nueva al vivo
        function connect(){
            const my = ++token
            clearTimers()
            retryPending = false
            attempts++
            hasSession = false
            pausedTotal = 0
            setState("loading")
            audio.preload = "auto"   // mantener la descarga activa también en pausa
            audio.load()
            audio.play().catch(err => {
                if (err.name !== "AbortError") fail(my)
            })
            watchdog = setTimeout(() => {
                if (my === token && audio.readyState < 3) fail(my)
            }, CONNECT_TIMEOUT)
        }

        // Un intento falló: reintentar antes de dar "Sin señal"
        function fail(my){
            if (my !== token || wanted !== "play" || retryPending) return
            token++
            clearTimers()
            hasSession = false
            if (attempts < MAX_ATTEMPTS) {
                setState("loading")
                retryPending = true
                retryTimer = setTimeout(connect, RETRY_DELAYS[attempts - 1])
            } else {
                wanted = "stop"
                audio.preload = "none"
                audio.load()
                setState("error")
            }
        }

        function stopConnecting(){
            token++
            clearTimers()
            retryPending = false
            wanted = "stop"
            hasSession = false
            audio.preload = "none"
            audio.load()   // corta la descarga pendiente
            setState("idle")
        }

        play.addEventListener("click", () => {
            const s = card.dataset.state

            if (s === "playing" || (s === "loading" && hasSession)) {
                wanted = "pause"
                pausedAt = Date.now()
                audio.pause()
                setState("paused")
                return
            }
            if (s === "loading") { stopConnecting(); return }

            wanted = "play"
            if ("mediaSession" in navigator && window.MediaMetadata) {
                navigator.mediaSession.metadata = new MediaMetadata({ title: name, artist: "Radio Player" })
            }

            if (s === "paused" && hasSession && !audio.error) {
                // Continuar desde donde se pausó, usando lo que se siguió guardando
                pausedTotal += Date.now() - pausedAt
                setState("loading")
                audio.play().catch(err => {
                    if (err.name !== "AbortError" && wanted === "play") { attempts = 0; firstStart = Date.now(); connect() }
                })
                return
            }

            attempts = 0
            firstStart = Date.now()
            connect()
        })
        range.addEventListener("input", () => { audio.volume = +range.value })

        audio.addEventListener("playing", () => {
            if (wanted !== "play") return
            clearTimers()
            hasSession = true
            attempts = 0
            setState("playing")
        })
        audio.addEventListener("waiting", () => {
            if (wanted === "play" && !audio.paused) setState("loading")
        })
        audio.addEventListener("pause", () => {
            if (wanted === "play" && hasSession) {
                // Pausa externa (auriculares, controles del sistema)
                wanted = "pause"
                pausedAt = Date.now()
                setState("paused")
            }
        })
        audio.addEventListener("play", () => {
            if (wanted === "pause" && hasSession) {
                // Reanudado desde controles del sistema
                wanted = "play"
                pausedTotal += Date.now() - pausedAt
            }
        })
        // Se terminó lo descargado o el servidor cortó: reconectar al vivo
        audio.addEventListener("ended", () => {
            if (wanted === "play") { attempts = 0; firstStart = Date.now(); connect() }
        })
        function onError(){
            if (wanted === "play") {
                if (hasSession) { attempts = 0; firstStart = Date.now(); connect() }
                else fail(token)
            } else if (wanted === "pause") {
                hasSession = false
                tick()
            }
        }
        audio.addEventListener("error", onError)
        const source = audio.querySelector("source")
        if (source) source.addEventListener("error", onError)

        setState("idle")
    }

    /* ---------- Observar lo que generan loadTV() / loadRadios() ---------- */
    function enhanceAll(){
        document.querySelectorAll("#tvPlayers > .tvPlayer").forEach(enhanceTile)
        document.querySelectorAll("#radioContainer > div").forEach(enhanceRadio)
    }
    enhanceAll()
    const mo = new MutationObserver(enhanceAll)
    mo.observe(stage, { childList: true })
    const radioContainer = document.getElementById("radioContainer")
    if (radioContainer) mo.observe(radioContainer, { childList: true })

})
