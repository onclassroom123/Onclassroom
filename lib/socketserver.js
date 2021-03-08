exports.ioserver = function(webServer) {
    const io = require('socket.io')(webServer);
    const functions = require('./customfunction')
    const socketFunctions = require('./socketfunctions')

    io.on('connection', async function(socket) {
        console.log('client connected. socket id=' + functions.getId(socket) + '  , total clients=' + functions.getClientCount(io));
        socket.on('disconnect', function() { socketFunctions.disconnect(socket, io) });

        socket.on('error', function(err) {
            console.error('socket ERROR:', err);
        });

        socket.on('connect_error', (err) => {
            console.error('client connection error', err);
        });

        socket.on('chatmessage', (message) => { socketFunctions.chatmessage(message, io, socket) });

        socket.on('lock', (data) => { socketFunctions.lock(data, io) });

        socket.on('unlock', (data) => { socketFunctions.unlock(data, io) });

        socket.on('is_locked', (data) => { socketFunctions.islocked(data, socket) });

        socket.on('success', socketFunctions.success);

        socket.on('reject', () => {
            console.log('Room is locked cancel')
            socket.emit('cancel')
        });

        socket.on('prepare_room', async(data, callback) => { socketFunctions.prepareRoom(data, callback, socket) })

        socket.on('getRouterRtpCapabilities', (data, callback) => { socketFunctions.getRouterRtpCapabilities(data, callback, socket) });

        socket.on('createProducerTransport', async(data, callback) => { socketFunctions.createProducerTransport(data, callback, socket) });

        socket.on('connectProducerTransport', async(data, callback) => { socketFunctions.connectProducerTransport(data, callback, socket) });

        socket.on('produce', async(data, callback) => { socketFunctions.produce(data, callback, socket) });
        socket.on('producedata', async(data, callback) => { socketFunctions.producedata(data, callback, socket) });

        socket.on('createConsumerTransport', async(data, callback) => { socketFunctions.createConsumerTransport(data, callback, socket) });

        socket.on('connectConsumerTransport', async(data, callback) => { socketFunctions.connectConsumerTransport(data, callback, socket) });

        socket.on('startRecording', async(data) => {
            await functions.startRecording(data.roomId, data.clientId)
        });
        socket.on('stopRecording', async(data) => {
            await functions.stopRecording(data.roomId)
        });

        socket.on('consume', async(data, callback) => {
            console.error('-- ERROR: consume NOT SUPPORTED ---');
            return;
        });

        socket.on('resume', async(data, callback) => {
            console.error('-- ERROR: resume NOT SUPPORTED ---');
            return;
        });

        socket.on('getCurrentProducers', async(data, callback) => { socketFunctions.getCurrentProducer(data, callback, socket) });

        socket.on('consumeAdd', async(data, callback) => { socketFunctions.consumeAdd(data, callback, socket) });

        socket.on('consumeDataAdd', async(data, callback) => { socketFunctions.consumeDataAdd(data, callback, socket) });

        socket.on('resumeAdd', async(data, callback) => { socketFunctions.resumeAdd(data, callback, socket) });

        // ---- sendback welcome message with on connected ---
        const newId = functions.getId(socket);
        socketFunctions.sendback(socket, { type: 'welcome', id: newId });
    });
}