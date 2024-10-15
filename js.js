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
            title: '<div class="d-flex justify-content-center "><iframe style="width:320px;height:260px;border-radius:10px;box-shadow:2px 4px 4px rgb(0 0 0 / 25%);justify-content:center;border:1px solid #bcbcbc" src="https://dolarhoy.com/i/cotizaciones/dolar-blue" frameborder="0"></iframe></div>',
            background: swalBackground,
            icon: "success",
            confirmButtonColor: "#4CAF50",
            confirmButtonText: "OK"
          })
    })

    var hoverActiveColor = '#FF9999'
    var hoverInactiveColor = '';

    $('li a').hover(function() {
        $(this).css('color', hoverActiveColor).addClass("active")
    }, function() {
        $(this).css('color', hoverInactiveColor).removeClass("active")
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
    
    $("#btnCronica").click(function(){
        $("#divCronica").slideToggle("slow")
        $("#btnCronica").toggleClass("btn-outline-secondary")
        $("#btnCronica").toggleClass("btn-secondary")
    })

    $("#btnCanal26").click(function(){
        $("#divCanal26").slideToggle("slow")
        $("#btnCanal26").toggleClass("btn-outline-secondary")
        $("#btnCanal26").toggleClass("btn-secondary")
    })

    $("#btnTelefeNoticias").click(function(){
        $("#divTelefeNoticias").slideToggle("slow")
        $("#btnTelefeNoticias").toggleClass("btn-outline-secondary")
        $("#btnTelefeNoticias").toggleClass("btn-secondary")
    })

    $("#btnC5N").click(function(){
        $("#divC5N").slideToggle("slow")
        $("#btnC5N").toggleClass("btn-outline-secondary")
        $("#btnC5N").toggleClass("btn-secondary")
    })

    $("#btnTelediarioRioIV").click(function(){
        $("#divTelediarioRioIV").slideToggle("slow")
        $("#btnTelediarioRioIV").toggleClass("btn-outline-secondary")
        $("#btnTelediarioRioIV").toggleClass("btn-secondary")
    })

    $("#switchLight").change(function(){

        if ($(this).prop("checked") == true) {
            // Light
            $("#body").css({'background-color':'#F5F5F5'})
            $("[name=titulo]").css({'color':'#d71414'})
            $(".offcanvas-body").css({'background-color':'#F5F5F5'})
            swalBackground = "#F5F5F5"
            swalColor = "#FF0000"
            hoverActiveColor = '#FF0000'
            hoverInactiveColor = '#d71414';
            $('li a').css('color', hoverActiveColor).addClass("active")
            $('li a').css('color', hoverInactiveColor).removeClass("active")
            $("[name=navbar]").css({'background-color':'#FFFFFF'})
            $("[name=navbarButton]").css({'background-color':'#696969'})
            $("h5").css({'color':'#696969'})
            $("[name =header]").css({'background-color':'#FFFFFF'})

        } else {
            // Dark
            $("#body").css({'background-color':'#16161d'})
            $("[name=titulo]").css({'color':'#FF9999'})
            $(".offcanvas-body").css({'background-color':'#16161d'})
            swalBackground = "#333333"
            swalColor = "#FF9966"
            hoverActiveColor = '#FF9999'
            hoverInactiveColor = '';
            $('li a').css('color', hoverActiveColor).addClass("active")
            $('li a').css('color', hoverInactiveColor).removeClass("active")
            $("[name=navbar]").css({'background-color':'#333333'})
            $("[name=navbarButton]").css({'background-color':''})
            $("h5").css({'color':''})
            $("[name =header]").css({'background-color':''})
        }
        
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