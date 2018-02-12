
var opts = BuddhaNumConv.DEFAULT_OPTIONS;

$(document).ready(function() {
	$("#form").submit(function(e) {
	    e.preventDefault();
		convert();
	});

    $("#input-coef").val("1.0");
    $("#input-exp").val("7");
    $("#input-number").val("10000000");

    updateFieldWidth();
    $("#input-coef,#input-exp").keyup(updateFieldWidth).blur(updateFieldWidth);

    $("input.opt").click(function(e) {
            opts[this.id] = $(this).is(":checked");
            $("#rakushaToComma").prop("disabled", opts.allInKanji);
        })
        .prop("checked", function() {
            return opts[this.id];
        });

    $("#rakushaToComma").prop("disabled", opts.allInKanji);

    // Form switcher
    $(".box-input .cont > div").hide();

    $switcher = $("#form-switcher > input");
    $switcher.click(function onSwitcherSelected() {
        $(this).addClass("active");
        $switcher.filter((idx, elm) => this !== elm).removeClass("active");
        if (this.id == "sw-number") {
            $("#expression").hide();
            $("#number").show();
        }
        else {
            $("#number").hide();
            $("#expression").show();
        }
    })

    $("#sw-exp").click();
});

function updateFieldWidth() {
    var $coef = $("#input-coef");
    var $exp = $("#input-exp")
    $coef.outerWidth(50);
    $exp.outerWidth(50);

    var wholeW = $("#expression").outerWidth();
    var coefSW = $coef[0].scrollWidth;
    var expSW = $exp[0].scrollWidth;
    var midW = $("#mid").outerWidth();
    var spaceW = wholeW - midW - 50;

    if (coefSW + expSW > spaceW) {
        $coef.outerWidth((wholeW - midW) * (coefSW / (coefSW + expSW)) - 5);
        $exp.outerWidth((wholeW - midW) * (expSW / (coefSW + expSW)) - 5);
    } else {
        if (coefSW > 50) {
            $coef.width(coefSW);
        }
        if (expSW > 50) {
            $exp.width(expSW);
        }
    }
}

function convert() {
    var coef, exp;

    if ($("#expression").is(":visible")) {
        coef = $("#input-coef").val();
        exp = $("#input-exp").val();
    } else {
        coef = $("#input-number").val().replace(/,/g, "");
        exp = "0";
    }

    try {
        new BuddhaNumConv(coef, exp)
            .setOptions(opts)
            .convert()
            .output($("#result"));
    } catch (e) {
        var $error = $("<div class='error'>");
        $error.text(e.message);

        $("#result").empty().append($error);
    }
}
