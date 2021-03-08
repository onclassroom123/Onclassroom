const chatInputBox = document.querySelector('#chat_message')
const allFile = document.querySelector('#all_files')
const all_messages = document.querySelector('#all_messages')
const main__chat__window = document.querySelector('#main__chat__window');

const variables = {
    participant: $('#participant'),
    chat: $('#chat'),
    participants_window: $('#participants_window'),
    chat_window: $('#chat_window'),
    chat_Btn: $('#chat_Btn'),
    body: $('body'),
    sidebar: $('#sidebar')
}

$('#videoDevices').on('change', async() => {
    let id = $('#videoDevices').val();
    localVideoStream = await getUserStream({ 'video': { 'deviceId': id } });
    remoteVideos[socket.id] = localVideoStream;
    remoteContainer.srcObject = localVideoStream;
    const videoTrack = localVideoStream.getVideoTracks()[0];
    await videoProducer.replaceTrack({ track: videoTrack })
        .catch(err => {
            alert(err.message)
        });
});
$('#audioDevices').on('change', async() => {
    let id = $('#audioDevices').val();
    localAudioStream = await getUserStream({ 'audio': { 'deviceId': id } });
    const audioTrack = localAudioStream.getAudioTracks()[0];
    await audioProducer.replaceTrack({ track: audioTrack })
        .catch(err => {
            alert(err.message)
        });
});
$('#speakers').on('change', async() => {
    let id = $('#speakers').val();
    document.querySelector('#videoid').setSinkId(id).then(() => {
        console.log("Success");
    }).catch(err => {
        alert(err.message)
    })
});

$('#layout').on('change', async() => {
    let value = $('#layout').val();
    if (value === "sidebars") {
        $('#sidebars').removeClass('d-none');
    } else {
        $('#sidebars').addClass('d-none');
    }
});

$('#joinButton').on("click", async function() {
    sendRequest('is_locked', { roomId: roomId, clientId: clientId })
    socket.on('admit', () => {
        join()
    })
    socket.on('cancel', () => {

    })


});

$('#leave_meeting').on("click", function() {
    socket.emit("disconnect");
    window.location.replace(`http://localhost:3030/meeting/${roomId}`);

});

function showToast(value) {
    $(`#connected .toast-body`).text(value);
    var myToast = new bootstrap.Toast(document.getElementById("connected"), {
        autohide: true,
        animation: true,
    })
    myToast.show();
}

function showNotification() {
    pendingNotification.forEach(value => {
        setTimeout(showToast(pendingNotification.pop()), 1000);
    })
}
const playStop = () => {
    let enabled = localVideoStream.getVideoTracks()[0].enabled;
    if (enabled) {
        localVideoStream.getVideoTracks()[0].enabled = false;
        setPlayVideo();
    } else {
        setStopVideo();
        localVideoStream.getVideoTracks()[0].enabled = true;
    }
};

const setVideo = (id) => {
    document.querySelector('#videoid').srcObject = remoteVideos[id];
}
const stopScreenShare = () => {
    socket.emit("leave-room", ROOM_ID, screenPeerId);
    myScreenVideo.remove();
    myScreenVideo = null;
}

function enableElement() {
    $('#joinButton').hide();
    $('#recording,#lockButton,#screenShare,#participants,#chat__Btn,#inviteButton,#file__Btn,#settings').show();
}

function disableElement(id) {
    $('#joinButton').show();
    $('#recording,#lockButton,#screenShare,#participants,#chat__Btn,#inviteButton,#file__Btn,#settings').hide();
}

const muteUnmute = () => {
    const enabled = localAudioStream.getAudioTracks()[0].enabled;
    if (enabled) {
        localAudioStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    } else {
        setMuteButton();
        localAudioStream.getAudioTracks()[0].enabled = true;
    }
};

const setPlayVideo = () => {
    const html = `<i class="fa fa-video-slash"></i>`;
    document.getElementById("playPauseVideo").innerHTML = html;
};

const setStopVideo = () => {
    const html = `<i class=" fa fa-video-camera"></i>`;
    document.getElementById("playPauseVideo").innerHTML = html;
};

const setUnmuteButton = () => {
    const html = `<i class="fa fa-microphone-slash"></i>`;
    document.getElementById("muteButton").innerHTML = html;
};
const setMuteButton = () => {
    const html = `<i class="fa fa-microphone"></i>`;
    document.getElementById("muteButton").innerHTML = html;
};

const setScreenShareButton = () => {
    const html = `<i class="fa fa-tv" style="color:red;"></i>`;
    document.getElementById("screenShare").innerHTML = html;
};
const setStopScreenShareButton = () => {
    const html = `<i class="fa fa-tv"></i>`;
    document.getElementById("screenShare").innerHTML = html;
};

$(document).on("keydown", (e) => {
    if (e.which === 13 && chatInputBox.value != "") {
        messageProducer.send(chatInputBox.value);
        let li = document.createElement("li");
        li.innerHTML = `<span> <b> Me: </b>${chatInputBox.value}</span>`;
        all_messages.append(li);
        all_messages.scrollTop = all_messages.scrollHeight;
        chatInputBox.value = "";
    }
});

let file = {}

function selectfile(e) {
    file = e.target.files[0];
}

$('#fileSubmit').on('click', (e) => {
    messageProducer.send(file);
    let li = document.createElement("li");
    li.innerHTML = `<span> <b> Me: </b>${file.name}</span>`;
    all_files.append(li);
    file = {};
})

const ShowChat = (e) => {
    pendingMessage = 0;
    variables.sidebar.toggleClass('d-none');
    variables.participant.removeClass('acitve');
    variables.chat.addClass('active');
    variables.chat_Btn.removeClass('has_new').children('i').html('Chat');
    variables.participants_window.removeClass('active show');
    variables.chat_window.addClass('active show')
    e.classList.toggle("active")
}
const SendFiles = (e) => {
    // pendingMessage = 0;

    // document.getElementById("chat").classList.add("active")
    // document.getElementById("participant").classList.remove("active")
    // document.getElementById("file_window").classList.add("show")
    // document.getElementById("file_window").classList.add("active")
    // document.getElementById("participants_window").classList.remove("show")
    // document.getElementById("participants_window").classList.remove("active")
    // document.getElementById("file__Btn").classList.remove("has__new");
    // document.getElementById("file__Btn").children[1].innerHTML = `Chat`;
    // e.classList.toggle("active")
    // document.body.classList.toggle("showChat")
}
const ShowParticipants = (e) => {
    variables.participant.addClass('active');
    variables.sidebar.toggleClass('d-none');
    variables.chat.removeClass('active');
    variables.chat_window.removeClass('show active');
    variables.participants_window.addClass('show active')
    e.classList.toggle("active")
}
const copyToClipboard = () => {
    var copyText = document.createElement("input");
    copyText.value = window.location.href;
    document.body.appendChild(copyText);
    copyText.select();
    copyText.setSelectionRange(0, 99999)
    document.execCommand("copy");
    document.body.removeChild(copyText);
    alert("Copied the text: " + copyText.value);
}
$('#inviteButton').click(copyToClipboard)