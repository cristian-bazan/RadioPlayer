$(document).ready(function(){

    $("#btn-frase").click(function(){
        fetch('txt.txt')
        .then(res => res.text())
        .then(content => {
            let lines = content.split(/\n/)
            Swal.fire({
                title: lines[Math.floor(Math.random() * lines.length)].toString(),
                color: "#FF9966",
                background: "#333333",
                confirmButtonColor: "#424242",
                confirmButtonText: "Gracias!"
            })
        })
    })

    $("#btn-cotizacion").click(function(){
        Swal.fire({
            title: '<div class="d-flex justify-content-center "><iframe style="width:320px;height:260px;border-radius:10px;box-shadow:2px 4px 4px rgb(0 0 0 / 25%);justify-content:center;border:1px solid #bcbcbc" src="https://dolarhoy.com/i/cotizaciones/dolar-blue" frameborder="0"></iframe></div>',
            background: "#333333",
            icon: "success",
            confirmButtonColor: "#424242",
            confirmButtonText: "OK"
          })
    })

    $('li a').hover(function() {
        $(this).css('color', '#FF9999').addClass("active")
    }, function() {
        $(this).css('color', '').removeClass("active")
    });

    $("#btnlaNacion").click(function(){
        $("#divLaNacion").slideToggle("slow")
        $("#btnlaNacion").toggleClass("btn-outline-secondary")
        $("#btnlaNacion").toggleClass("btn-secondary")
    })

    $("#btnTN").click(function(){
        $("#divTN").slideToggle("slow")
        $("#btnTN").toggleClass("btn-outline-secondary")
        $("#btnTN").toggleClass("btn-secondary")
    })

    $("#btnEl12").click(function(){
        $("#divEl12").slideToggle("slow")
        $("#btnEl12").toggleClass("btn-outline-secondary")
        $("#btnEl12").toggleClass("btn-secondary")
    })
    
    let installPrompt = null;
    const installButton = document.querySelector("#install");

    window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.removeAttribute("hidden");
    });

    installButton.addEventListener("click", async () => {
    if (!installPrompt) {
        return;
    }
    const result = await installPrompt.prompt();
    console.log(`Install prompt was: ${result.outcome}`);
    installPrompt = null;
    installButton.setAttribute("hidden", "");
    });
})