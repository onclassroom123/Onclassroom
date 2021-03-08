let is_recording = false;
let pendingConfirmation = {}
$('#lockButton').on("click", function() {
    if (is_locked) {
        socket.emit('unlock', { roomId });
    } else {
        socket.emit('lock', { roomId });
    }

});
$('#recording').on('click', function() {
    if (is_recording) {
        socket.emit("stopRecording", { roomId: roomId, clientId: clientId });
        is_recording = false;
    } else {
        socket.emit("startRecording", { roomId: roomId, clientId: clientId });
        is_recording = true;
    }
})



const setUnlockButton = () => {
    const html = `<i class="fa fa-unlock-alt"></i`;
    document.getElementById("lockButton").innerHTML = html;
};
const setLockButton = () => {
    const html = `<i class="fa fa-lock"></i>`;
    document.getElementById("lockButton").innerHTML = html;
};
const setRecordButton = () => {
    const html = `<i class="fa fa-stop-circle" style="color:red;"></i>`;
    document.getElementById("recordBtn").innerHTML = html;
};
const setStopRecordButton = () => {
    const html = `<i class="fa fa-play-circle"></i>`;
    document.getElementById("recordBtn").innerHTML = html;
};