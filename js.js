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

    $("#btn-cotizacion").click(function(){
        Swal.fire({
            title: '<div class="d-flex justify-content-center"><iframe style="width:320px;height:260px;border-radius:10px;box-shadow:2px 4px 4px rgb(0 0 0 / 25%);border:1px solid #bcbcbc" src="https://dolarhoy.com/i/cotizaciones/dolar-bancos-y-casas-de-cambio"></iframe></div><div class="d-flex justify-content-center"><iframe style="width:320px;height:260px;border-radius:10px;box-shadow:2px 4px 4px rgb(0 0 0 / 25%);border:1px solid #bcbcbc" src="https://dolarhoy.com/i/cotizaciones/dolar-blue"></iframe></div>',
            background: swalBackground,
            icon: "success",
            confirmButtonColor: "#4CAF50",
            confirmButtonText: "OK"
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