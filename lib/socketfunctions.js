const functions = require('./customfunction')

let clientSocket = [];
exports.disconnect = function(socket, io) {
    const roomName = getRoomname(socket);
    // close user connection
    console.log('client disconnected. socket id=' + functions.getId(socket) + '  , total clients=' + functions.getClientCount(io));
    functions.cleanUpPeer(roomName, socket);
    socket.broadcast.to(roomName).emit('user-disconnected', { userId: functions.getId(socket), name: functions.getRoom(roomName).member[functions.getId(socket)] });
    // --- socket.io room ---
    functions.removeMember(roomName, functions.getId(socket))
    socket.leave(roomName);
}

exports.chatmessage = function(message, io, socket) {
    io.in(getRoomname(socket)).emit('createMessage', message);
}
exports.lock = function(data, io) {
    functions.lock(data.roomId)
    io.in(data.roomId).emit('locked')
    console.log("Room locked:" + functions.is_locked(data.roomId))
}

exports.unlock = function(data, io) {
    functions.unlocked(data.roomId)
    io.in(data.roomId).emit('unlocked')
    console.log("Room locked:" + functions.is_locked(data.roomId))
}

exports.islocked = function(data, socket) {
    value = functions.is_locked(data.roomId)
    if (value) {
        room = functions.getRoom(data.roomId)
        clientSocket.push(socket);
        room.host.emit('confirm', { clientId: data.clientId })
    } else {
        socket.emit('admit')
    }
}

exports.success = function() {
    console.log('Room is locked')
    clientSocket.shift().emit('admit')
}

exports.prepareRoom = async function(data, callback, socket) {
    const roomId = data.roomId;
    const existRoom = functions.getRoom(roomId);
    if (existRoom) {
        console.log('--- use exist room. roomId=' + roomId);
    } else {
        console.log('--- create new room. roomId=' + roomId);
        await functions.startWorker(roomId, socket);
    }
    if (functions.is_locked(roomId)) {
        socket.emit('locked');
    }
    functions.addMember(roomId, functions.getId(socket), data.name)

    socket.join(roomId);
    socket.broadcast.to(roomId).emit('newUser', { userId: functions.getId(socket), name: data.name });
    setRoomname(roomId, socket);
    sendResponse(functions.getRoom(roomId).member, callback)
}

exports.getRouterRtpCapabilities = function(data, callback) {
    console.log('getRouter')
    const router = functions.getRouter(data.roomId)

    if (router) {
        //console.log('getRouterRtpCapabilities: ', router.rtpCapabilities);
        sendResponse(router.rtpCapabilities, callback);
    } else {
        sendReject({ text: 'ERROR- router NOT READY' }, callback);
    }
}

exports.createProducerTransport = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    console.log('-- createProducerTransport ---room=%s', roomName);
    const { transport, params } = await functions.createTransport(roomName);
    functions.addProducerTrasport(roomName, functions.getId(socket), transport);
    transport.observer.on('close', () => {
        const id = functions.getId(socket);
        const videoProducer = functions.getProducer(roomName, id, 'video');
        if (videoProducer) {
            videoProducer.close();
            functions.removeProducer(roomName, id, 'video');
        }
        const audioProducer = functions.getProducer(roomName, id, 'audio');
        if (audioProducer) {
            audioProducer.close();
            functions.removeProducer(roomName, id, 'audio');
        }
        functions.removeProducerTransport(roomName, id);
    });
    //console.log('-- createProducerTransport params:', params);
    sendResponse(params, callback);
}

exports.connectProducerTransport = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const transport = functions.getProducerTrasnport(roomName, functions.getId(socket));
    await transport.connect({ dtlsParameters: data.dtlsParameters });
    sendResponse({}, callback);
}

exports.produce = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const { kind, rtpParameters } = data;
    console.log('-- produce --- kind=' + kind);
    const id = functions.getId(socket);
    const transport = functions.getProducerTrasnport(roomName, id);
    if (!transport) {
        console.error('transport NOT EXIST for id=' + id);
        return;
    }
    const producer = await transport.produce({ kind, rtpParameters });
    functions.addProducer(roomName, id, producer, kind);
    producer.observer.on('close', () => {
        console.log('producer closed --- kind=' + kind);
    })
    sendResponse({ id: producer.id }, callback);

    // inform clients about new producer

    if (roomName) {
        console.log('--broadcast room=%s newProducer ---', roomName);
        socket.broadcast.to(roomName).emit('newProducer', { socketId: id, producerId: producer.id, kind: producer.kind });
    } else {
        console.log('--broadcast newProducer ---');
        socket.broadcast.emit('newProducer', { socketId: id, producerId: producer.id, kind: producer.kind });
    }
}
exports.producedata = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const { sctpStreamParameters, label } = data;
    console.log('-- produce --- label=' + label);
    const id = functions.getId(socket);
    const transport = functions.getProducerTrasnport(roomName, id);
    if (!transport) {
        console.error('transport NOT EXIST for id=' + id);
        return;
    }
    const dataProducer = await transport.produceData({ sctpStreamParameters, label });
    functions.addDataProducer(roomName, id, dataProducer, label);
    dataProducer.observer.on('close', () => {
        console.log('data producer closed --- kind=' + label);
    })
    dataProducer.on('message', (message, ppid) => {
        console.log("message:", message)
    })
    sendResponse({ id: dataProducer.id }, callback);

    // inform clients about new producer

    if (roomName) {
        console.log('--broadcast room=%s newDataProducer ---', roomName);
        socket.broadcast.to(roomName).emit('newDataProducer', { socketId: id, dataProducerId: dataProducer.id, label: dataProducer.label });
    } else {
        console.log('--broadcast newDataProducer ---');
        socket.broadcast.emit('newDataProducer', { socketId: id, dataProducerId: dataProducer.id, label: dataProducer.label });
    }
}

exports.createConsumerTransport = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    console.log('-- createConsumerTransport -- id=' + functions.getId(socket));
    const { transport, params } = await functions.createTransport(roomName);
    functions.addConsumerTrasport(roomName, functions.getId(socket), transport);
    transport.observer.on('close', () => {
        const localId = functions.getId(socket);
        functions.removeConsumerSetDeep(roomName, localId);
        functions.removeConsumerTransport(roomName, localId);
    });
    //console.log('-- createTransport params:', params);
    sendResponse(params, callback);
}

exports.connectConsumerTransport = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    console.log('-- connectConsumerTransport -- id=' + functions.getId(socket));
    let transport = functions.getConsumerTrasnport(roomName, functions.getId(socket));
    if (!transport) {
        console.error('transport NOT EXIST for id=' + functions.getId(socket));
        return;
    }
    await transport.connect({ dtlsParameters: data.dtlsParameters });
    sendResponse({}, callback);
}

exports.getCurrentProducer = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const clientId = data.localId;
    console.log('-- getCurrentProducers for Id=' + clientId);

    const remoteVideoIds = functions.getRemoteIds(roomName, clientId, 'video');
    console.log('-- remoteVideoIds:', remoteVideoIds);
    const remoteAudioIds = functions.getRemoteIds(roomName, clientId, 'audio');
    console.log('-- remoteAudioIds:', remoteAudioIds);
    const remoteMessageIds = functions.getRemoteIds(roomName, clientId, 'message');
    console.log('-- remoteMessageIds:', remoteMessageIds);
    const remotefileIds = functions.getRemoteIds(roomName, clientId, 'file');
    console.log('-- remoteFileIds:', remotefileIds);
    sendResponse({ remoteVideoIds: remoteVideoIds, remoteAudioIds: remoteAudioIds, remoteMessageIds: remoteMessageIds, remoteFileIds: remotefileIds }, callback);
}

exports.consumeAdd = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const localId = functions.getId(socket);
    const kind = data.kind;
    console.log('-- consumeAdd -- localId=%s kind=%s', localId, kind);

    let transport = functions.getConsumerTrasnport(roomName, localId);
    if (!transport) {
        console.error('transport NOT EXIST for id=' + localId);
        return;
    }
    const rtpCapabilities = data.rtpCapabilities;
    const remoteId = data.remoteId;
    console.log('-- consumeAdd - localId=' + localId + ' remoteId=' + remoteId + ' kind=' + kind);
    const producer = functions.getProducer(roomName, remoteId, kind);
    if (!producer) {
        console.error('producer NOT EXIST for remoteId=%s kind=%s', remoteId, kind);
        return;
    }
    const { consumer, params } = await functions.createConsumer(roomName, transport, producer, rtpCapabilities); // producer must exist before consume
    //subscribeConsumer = consumer;
    functions.addConsumer(roomName, localId, remoteId, consumer, kind); // TODO: MUST comination of  local/remote id
    console.log('addConsumer localId=%s, remoteId=%s, kind=%s', localId, remoteId, kind);
    consumer.observer.on('close', () => {
        console.log('consumer closed ---');
    })
    consumer.on('producerclose', () => {
        console.log('consumer -- on.producerclose');
        consumer.close();
        functions.removeConsumer(roomName, localId, remoteId, kind);

        // -- notify to client ---
        socket.emit('producerClosed', { localId: localId, remoteId: remoteId, kind: kind });
    });

    console.log('-- consumer ready ---');
    sendResponse(params, callback);
}

exports.consumeDataAdd = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const localId = functions.getId(socket);
    const label = data.label;
    console.log("Data is:", data)
    console.log('-- consumeDataAdd -- localId=%s label=%s', localId, label);

    let transport = functions.getConsumerTrasnport(roomName, localId);
    if (!transport) {
        console.error('transport NOT EXIST for id=' + localId);
        return;
    }
    const remoteId = data.remoteId;
    console.log('-- consumeDataAdd - localId=' + localId + ' remoteId=' + remoteId + ' label=' + label);
    const producer = functions.getProducer(roomName, remoteId, label);
    if (!producer) {
        console.error('producer NOT EXIST for remoteId=%s label=%s', remoteId, label);
        return;
    }
    const { consumer, params } = await functions.createDataConsumer(roomName, transport, producer); // producer must exist before consume
    //subscribeConsumer = consumer;
    functions.addConsumer(roomName, localId, remoteId, consumer, label); // TODO: MUST comination of  local/remote id
    console.log('addConsumer localId=%s, remoteId=%s, label=%s', localId, remoteId, label);
    consumer.observer.on('close', () => {
        console.log('consumer closed ---');
    })
    consumer.on('dataproducerclose', () => {
        console.log('consumer -- on.dataproducerclose');
        consumer.close();
        functions.removeConsumer(roomName, localId, remoteId, label);

        // -- notify to client ---
        socket.emit('dataProducerClosed', { localId: localId, remoteId: remoteId, label: label });
    });
    consumer.on('message', () => {

    })

    console.log('-- consumer ready ---');
    sendResponse(params, callback);
}

exports.resumeAdd = async function(data, callback, socket) {
    const roomName = getRoomname(socket);
    const localId = functions.getId(socket);
    const remoteId = data.remoteId;
    const kind = data.kind;
    console.log('-- resumeAdd localId=%s remoteId=%s kind=%s', localId, remoteId, kind);
    let consumer = functions.getConsumer(roomName, localId, remoteId, kind);
    if (!consumer) {
        console.error('consumer NOT EXIST for remoteId=' + remoteId);
        return;
    }
    await consumer.resume();
    sendResponse({}, callback);
}
exports.sendback = function(socket, message) {
    socket.emit('message', message);
}

function sendResponse(response, callback) {
    //console.log('sendResponse() callback:', callback);
    callback(null, response);
}

// --- send error to client ---
function sendReject(error, callback) {
    callback(error.toString(), null);
}

function setRoomname(room, socket) {
    socket.roomname = room;
}

function getRoomname(socket) {
    const room = socket.roomname;
    return room;
}