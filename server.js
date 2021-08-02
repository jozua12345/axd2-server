require('dotenv').config()

let HashMap = require('hashmap')
let waitingList = new HashMap()
let pairs = new HashMap()
let server

if (process.env.HTTPS == 'false') {
    server = require('http').createServer()
}else {
    const fs = require('fs')
    server = require('https').createServer({
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH)
    })
}

const io = require('socket.io')(server, {
    cors: {
        origin: [process.env.CLIENT_URL],
        methods: ["GET", "POST"],
    },
})

io.on("connect_error", (err) => {
  console.log(`connect_error due to ${err.message}`);
})

io.on('connection', socket => {
    const name = socket.handshake.query.name
    
    if (waitingList.size == 0) {
        waitingList.set(socket.id, name)
    }else {

        // Get the first item O(1)
        for (item in waitingList._data) {
            targetId = waitingList._data[item][0]
            break
        }
        targetName = waitingList.get(targetId)
        waitingList.delete(targetId)

        pairs.set(targetId, socket.id)
        pairs.set(socket.id, targetId)

        io.to(targetId).emit('pairing', {
            _name: name,
            _socketId: socket.id
        })
        io.to(socket.id).emit('pairing', {
            _name: targetName,
            _socketId: targetId
        })
    }

    socket.on('send', (message, targetId) => {
        socket.to(targetId).emit('receive', message)
    })

    socket.on('state', (state, targetId) => {
        socket.to(targetId).emit('state', state)
    })

    socket.on('disconnect', () => {

        if (waitingList.has(socket.id)) {
            waitingList.delete(socket.id)
        }
        if (pairs.has(socket.id) && pairs.has(pairs.get(socket.id))) {
            socket.to(pairs.get(socket.id)).emit('state', 'DISCONNECTED')
            pairs.delete(pairs.get(socket.id))
        }
        if (pairs.has(socket.id)) {
            socket.to(socket.id).emit('state', 'DISCONNECTED')
            pairs.delete(socket.id)
        }
    })
})

server.listen(3000)
