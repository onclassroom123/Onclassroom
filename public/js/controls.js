const chatInputBox = document.querySelector('#chat_message')
const fileSubmit = document.querySelector('#fileSubmit')
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

const playStop = () => {
    let enabled = localStream.getVideoTracks()[0].enabled;
    if (enabled) {
        localStream.getVideoTracks()[0].enabled = false;
        setPlayVideo();
    } else {
        setStopVideo();
        localStream.getVideoTracks()[0].enabled = true;
    }
};
const stopScreenShare = () => {
    socket.emit("leave-room", ROOM_ID, screenPeerId);
    myScreenVideo.remove();
    myScreenVideo = null;
}

function enableElement() {
    $('#joinButton').hide();
    $('#startRecording,#stopRecording,#lockButton,#screenShare,#participants,#chat__Btn,#inviteButton,#file__Btn').show();
}

function disableElement(id) {
    $('#joinButton').show();
    $('#startRecording,#stopRecording,#lockButton,#screenShare,#participants,#chat__Btn,#inviteButton,#file__Btn').hide();
}

const muteUnmute = () => {
    const enabled = localStream.getAudioTracks()[0].enabled;
    if (enabled) {
        localStream.getAudioTracks()[0].enabled = false;
        setUnmuteButton();
    } else {
        setMuteButton();
        localStream.getAudioTracks()[0].enabled = true;
    }
};

const setPlayVideo = () => {
    const html = `<i class="unmute fa fa-pause-circle"></i>`;
    document.getElementById("playPauseVideo").innerHTML = html;
};

const setStopVideo = () => {
    const html = `<i class=" fa fa-video-camera"></i>`;
    document.getElementById("playPauseVideo").innerHTML = html;
};

const setUnmuteButton = () => {
    const html = `<i class="unmute fa fa-microphone-slash"></i>`;
    document.getElementById("muteButton").innerHTML = html;
};
const setMuteButton = () => {
    const html = `<i class="fa fa-microphone"></i>`;
    document.getElementById("muteButton").innerHTML = html;
};

const setUnlockButton = () => {
    const html = `<i class="unmute fa fa-unlock"></i`;
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

const setScreenShareButton = () => {
    const html = `<i class="fa fa-tv" style="color:red;"></i>`;
    document.getElementById("screenShare").innerHTML = html;
};
const setStopScreenShareButton = () => {
    const html = `<i class="fa fa-tv"></i>`;
    document.getElementById("screenShare").innerHTML = html;
};

document.addEventListener("keydown", (e) => {
    if (e.which === 13 && chatInputBox.value != "") {
        messageProducer.send(chatInputBox.value);
        let li = document.createElement("li");
        li.innerHTML = `<span> <b> Me: </b>${chatInputBox.value}</span>`;
        all_messages.append(li);
        chatInputBox.value = "";
    }
});

let file = {}

function selectfile(e) {
    file = e.target.files[0];
}

fileSubmit.addEventListener('click', (e) => {
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
    variables.body.toggleClass('showChat')
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
    variables.body.toggleClass('showChat')
}
const showInvitePopup = () => {
    document.body.classList.add("showInvite");
    document.getElementById("roomLink").value = window.location.href;

}
const hideInvitePopup = () => {
    document.body.classList.remove("showInvite");
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