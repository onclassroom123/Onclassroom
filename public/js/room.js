let localVideo;
const remoteContainer = document.querySelector('#videoid')
const stateSpan = document.querySelector('#state_span')
let localAudioStream = null;
let localVideoStream = null;
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
var members = {};
let pendingMessage = 0;
let is_locked = false;
let pendingNotification = [];
let remoteVideos = {}

// =========== socket.io ========== 
let socket = null;

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
                roomId: roomId
            });
            for (const key in data) {
                addMember(key, data[key]);
            }
        });

        socket.on('newUser', function(data) {
            addMember(data.userId, data.name);
            pendingNotification.push(`${data.name} joined`)
            if (pendingNotification.length === 1) {
                showNotification();
            }
        });

        socket.on('user-disconnected', function(data) {
            removeMember(data.userId);
            pendingNotification.push(`${data.name} disconneted`)
            if (pendingNotification.length === 1) {
                showNotification();
            }
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
            pendingNotification.push("Meeting is locked");
            if (pendingNotification.length === 1) {
                showNotification();
            }
        })

        socket.on('unlocked', function() {
            is_locked = false;
            setUnlockButton();
            pendingNotification.push("Meeting is unlocked");
            if (pendingNotification.length === 1) {
                showNotification();
            }
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
    if (kind === 'audio') {
        remoteVideos[id].addTrack(track);
        return;
    }

    const newStream = new MediaStream();
    newStream.addTrack(track);
    remoteVideos[id] = newStream;
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
// Updates the select element with the provided set of cameras
function updateCameraList(devices, selectors) {
    const listElement = document.querySelector(selectors);
    listElement.innerHTML = '';
    devices.map(camera => {
        const cameraOption = document.createElement('option');
        cameraOption.label = camera.label;
        cameraOption.value = camera.deviceId;
        return cameraOption;
    }).forEach(cameraOption => {
        listElement.add(cameraOption)

    });
}

//Update the select audio list
// Fetch an array of devices of a certain type
async function getConnectedDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
}

// Get the initial set of cameras connected
function updateDevices() {
    getConnectedDevices().then(devices => {
        let videos = devices.filter(device => device.kind === "videoinput");
        let audioinput = devices.filter(device => device.kind === "audioinput");
        let audiooutput = devices.filter(device => device.kind === "audiooutput");
        updateCameraList(videos, 'select#videoDevices');
        updateCameraList(audioinput, 'select#audioDevices');
        updateCameraList(audiooutput, 'select#speakers');
    })
}
updateDevices();

// Listen for changes to media devices and update the list accordingly
navigator.mediaDevices.addEventListener('devicechange', event => {
    updateDevices()
});

async function getUserStream(option) {
    return await navigator.mediaDevices.getUserMedia(option)
        .catch(err => {
            alert(err.message);
        });
}

// ============ UI button ==========

async function startMedia() {
    if (localVideoStream && localAudioStream) {
        console.warn('WARN: local media ALREADY started');
        return;
    }
    await connectSocket().catch(err => {
        console.error(err);
        return;
    });
    localVideoStream = await getUserStream({ video: true });
    remoteVideos[socket.id] = localVideoStream;
    remoteContainer.srcObject = localVideoStream;
    localAudioStream = await getUserStream({ audio: true });
}
disableElement();
startMedia();