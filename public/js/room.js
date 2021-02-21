let localVideo;
const remoteContainer = document.querySelector('#video-grid')
const stateSpan = document.querySelector('#state_span')
let localStream = null;
let screenStream = null;
let clientId = null;
let device = null;
let producerTransport = null;
let screenProducerTransport = null;
let videoProducer = null;
let screenvideoProducer = null;
let audioProducer = null;
let messageProducer = null;
let fileProducer = null;
let consumerTransport = null;
let videoConsumers = {};
let audioConsumers = {};
let messageConsumers = {};
let fileConsumers = {};
let members = {};
let pendingMessage = 0;
let is_locked = false;
let is_recording = false;


// =========== socket.io ========== 
let socket = null;

function showToast(id, value) {
    $(`#${id} .toast-body`).text(value);
    console.log(value)
    var myToast = new bootstrap.Toast(document.getElementById(id), {
        autohide: true,
        animation: true,
    })
    myToast.show();
}

// return Promise
function connectSocket() {
    if (socket) {
        socket.close();
        socket = null;
        clientId = null;
    }
    return new Promise((resolve, reject) => {
        socket = io.connect('/');

        socket.on('connect', async function(evt) {
            //console.log('socket.io connected()');

            // --- prepare room ---
            console.log('socket.io connected(). prepare room=%s', roomId);
            var data = await sendRequest('prepare_room', {
                roomId: roomId,
                name: myName
            });
            for (const key in data) {
                addMember(key, data[key]);
            }
        });

        socket.on('newUser', function(data) {
            addMember(data.userId, data.name);
            showToast("connected", `${data.name} connected`)
        });

        socket.on('user-disconnected', function(data) {
            removeMember(data.userId)
            showToast("disconnected", `${data.name} disconneted`)
        });

        document.getElementById('lockButton').addEventListener("click", function() {
            if (is_locked) {
                socket.emit('unlock', { roomId: roomId });
            } else {
                socket.emit('lock', { roomId: roomId });
            }

        });

        document.getElementById('joinButton').addEventListener("click", async function() {
            sendRequest('is_locked', { roomId: roomId, clientId: clientId })
            socket.on('admit', () => {
                join()
            })
            socket.on('cancel', () => {

            })


        });

        document.getElementById('leave_meeting').addEventListener("click", function() {
            socket.emit("disconnect");
            window.location.replace(`http://localhost:3030/meeting/${roomId}`);

        });

        socket.on('confirm', (data) => {
            console.log("User wants to join", data.clientId)
            value = window.confirm(`User: ${data.clientId} want to join`)
            admit.show()
            if (value) {
                console.log(value)
                socket.emit('success')
            } else {
                socket.emit('reject')
            }
        })

        socket.on('locked', function() {
            is_locked = true;
            setLockButton();
            showToast('locked', "Meeting is locked");
        })

        socket.on('unlocked', function() {
            is_locked = false;
            setUnlockButton()
            showToast('locked', "Meeting is unlocked")
        })

        socket.on('error', function(err) {
            console.error('socket.io ERROR:', err);
            reject(err);
        });
        socket.on('disconnect', function(evt) {
            console.log('socket.io disconnect:', evt);
        });
        socket.on('message', function(message) {
            console.log('socket.io message:', message);
            if (message.type === 'welcome') {
                if (socket.id !== message.id) {
                    console.warn('WARN: something wrong with clientID', socket.io, message.id);
                }

                clientId = message.id;
                console.log('connected to server. clientId=' + clientId);

                resolve();
            } else {
                console.error('UNKNOWN message from server:', message);
            }
        });
        socket.on('newProducer', function(message) {
            console.log('socket.io newProducer:', message);
            const remoteId = message.socketId;
            const prdId = message.producerId;
            const kind = message.kind;
            if (kind === 'video') {
                console.log('--try consumeAdd remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
                consumeAdd(consumerTransport, remoteId, prdId, kind);
            } else if (kind === 'audio') {
                //console.warn('-- audio NOT SUPPORTED YET. skip remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
                console.log('--try consumeAdd remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
                consumeAdd(consumerTransport, remoteId, prdId, kind);
            } else if (kind === 'screen') {
                //console.warn('-- audio NOT SUPPORTED YET. skip remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
                console.log('--try consumeAdd remoteId=' + remoteId + ', prdId=' + prdId + ', kind=' + kind);
                consumeAdd(consumerTransport, remoteId, prdId, kind);
            }
        });
        socket.on('newDataProducer', function(message) {
            console.log('socket.io newDataProducer:', message);
            const remoteId = message.socketId;
            const prdId = message.dataProducerId;
            const label = message.label;
            if (label === 'message') {
                console.log('--try consumeDataAdd remoteId=' + remoteId + ', prdId=' + prdId + ', label=' + label);
                consumeDataAdd(consumerTransport, remoteId, prdId, label);
            } else if (label === 'file') {
                console.log('--try consumeDataAdd remoteId=' + remoteId + ', prdId=' + prdId + ', label=' + label);
                consumeDataAdd(consumerTransport, remoteId, prdId, label);
            }
        });

        socket.on('producerClosed', function(message) {
            console.log('socket.io producerClosed:', message);
            const localId = message.localId;
            const remoteId = message.remoteId;
            const kind = message.kind;
            console.log('--try removeConsumer remoteId=%s, localId=%s, track=%s', remoteId, localId, kind);
            removeConsumer(remoteId, kind);
            removeRemoteVideo(remoteId);
        })

        socket.on('dataProducerClosed', function(message) {
            console.log('socket.io producerClosed:', message);
            const localId = message.localId;
            const remoteId = message.remoteId;
            const label = message.label;
            console.log('--try removeConsumer remoteId=%s, localId=%s, label=%s', remoteId, localId, label);
            removeConsumer(remoteId, label);;
        })
    });
}

function recording() {
    if (is_recording) {
        socket.emit("stopRecording", { roomId: roomId, clientId: clientId });
        is_recording = false;
    } else {
        socket.emit("startRecording", { roomId: roomId, clientId: clientId });
        is_recording = true;
    }
}

function disconnectSocket() {
    if (socket) {
        socket.close();
        socket = null;
        clientId = null;
        console.log('socket.io closed..');
    }
}

function isSocketConnected() {
    if (socket) {
        return true;
    } else {
        return false;
    }
}

function sendRequest(type, data = {}) {
    return new Promise((resolve, reject) => {
        socket.emit(type, data, (err, response) => {
            if (!err) {
                // Success response, so pass the mediasoup response to the local Room.
                resolve(response);
            } else {
                reject(err);
            }
        });
    });
}

// =========== media handling ========== 
function stopLocalStream(stream) {
    let tracks = stream.getTracks();
    if (!tracks) {
        console.warn('NO tracks');
        return;
    }

    tracks.forEach(track => track.stop());
}

// return Promise
function playVideo(element, stream) {
    if (element.srcObject) {
        console.warn('element ALREADY playing, so ignore');
        return;
    }
    element.srcObject = stream;
    return element.play();
}

function pauseVideo(element) {
    element.pause();
    element.srcObject = null;
}

function addRemoteTrack(id, track, kind) {

    if (kind === 'video') {
        video = addRemoteVideo(id);
    }

    if (kind === 'audio') {
        let video = findRemoteVideo(id);
        video.srcObject.addTrack(track);
        return;
    }

    const newStream = new MediaStream();
    newStream.addTrack(track);
    playVideo(video, newStream)
        .catch(err => { console.error('media ERROR:', err) });
}

function addRemoteVideo(id) {

    let element = document.createElement('video');
    remoteContainer.appendChild(element);
    element.id = 'remote_' + id;
    return element;
}

function findRemoteVideo(id) {
    let element = document.getElementById('remote_' + id);
    return element;
}

function removeRemoteVideo(id) {
    console.log(' ---- removeRemoteVideo() id=' + id);
    let element = document.getElementById('remote_' + id);
    if (element) {
        element.pause();
        element.srcObject = null;
        remoteContainer.removeChild(element);
    } else {
        console.log('child element NOT FOUND');
    }
}

function removeAllRemoteVideo() {
    while (remoteContainer.firstChild) {
        remoteContainer.firstChild.pause();
        remoteContainer.firstChild.srcObject = null;
        remoteContainer.removeChild(remoteContainer.firstChild);
    }
}

// ============ UI button ==========
async function startMedia() {
    if (localStream) {
        console.warn('WARN: local media ALREADY started');
        return;
    }
    await connectSocket().catch(err => {
        console.error(err);
        return;
    });
    await navigator.mediaDevices.getUserMedia({ audio: { 'echoCancellation': true }, video: true })
        .then((stream) => {
            localStream = stream;
            localVideo = addRemoteVideo('local')
            localVideo.volume = 0;
            playVideo(localVideo, localStream);
        })
        .catch(err => {
            console.error('media ERROR:', err);
        });
}
disableElement();
startMedia();