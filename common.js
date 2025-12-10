/* Dark Mode */
document.getElementById("darkmode_setting").checked = (window.localStorage.getItem("darkmode") === 'true');
document.getElementById("darkmode_setting").addEventListener("change", function() { setDarkmode(document.getElementById("darkmode_setting").checked); })

setDarkmode(window.localStorage.getItem("darkmode") === 'true');

function setDarkmode(darkmode){
    if(darkmode == true){
        document.documentElement.setAttribute("color-mode", "dark");
    } else {
        document.documentElement.setAttribute("color-mode", "light");
    }
    window.localStorage.setItem("darkmode", darkmode);
}