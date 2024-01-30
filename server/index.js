import express from 'express'
import { Server } from "socket.io"
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const PORT = process.env.PORT || 3500
const ADMIN = "Admin"

const app = express()

app.use(express.static(path.join(__dirname, "public")))


const expressServer = app.listen(PORT, () =>{
    console.log(`listening on port ${PORT}`)
})

const UsersState = {
    users: [],
    setUsers: function(newUsersArray){
        this.users = newUsersArray
    }
}

const io = new Server(expressServer,{
    cors: {
        origin: process.env.NODE_ENV === "production" ? false : ["http://localhost:5500","http://127.0.0.1:5500"]
    }
})

io.on('connection', socket =>{
    console.log(`L'utilisateur ${socket.id} s'est connecté`)

    // A la connection - seulement pour l'utilisateur
    socket.emit('message',buildMsg(ADMIN, "Bienvenue dans ce chat IRC !"))
    socket.on('enterRoom', ({ name, room}) => {

        //quitter la dernière salle
        const prevRoom = getUser(socket.id)?.room

        if (prevRoom){
            socket.leave(prevRoom)
            io.to(prevRoom).emit('message', buildMsg(ADMIN, `${name} a quitté le channel`))
        }

        const user = activateUser(socket.id, name, room)

        if (prevRoom){
            io.to(prevRoom).emit('userList', {
                users: getUsersInRoom(prevRoom)

            })
        }

        //Rejoindre une salle
        socket.join(user.room)

        //Emet un message à l'utilisateur qui a rejoint
        socket.emit('message', buildMsg(ADMIN, `Vous avez rejoins le channel de ${user.romm}`))

        //Emet un message aux autres
        socket.broadcast.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} a rejoint le channel`))

        //Mettre à jour la liste des utilisateur d'une salle
        io.to(user.room).emit('userList', {
            users: getUsersInRoom(user.room)

        })

        //Mettre a jour les salles pour tout le monde
        io.emit('roomsList', {
            rooms: getAllActiveRooms()
        })

    })

    // A la connection - pour tous les autres
    socket.broadcast.emit('message',`L'utilisateur ${socket.id.substring(0,5)} est connecté`)

    // A la déconnexion - pour tous les autres
    socket.on('disconnect', () => {
        const user = getUser(socket.id)
        usersLeavesApp(socket.id)
        if (user) {
            io.to(user.room).emit('message', buildMsg(ADMIN, `${user.name} a quitté le channel`))

            io.to(user.room).emit('userList',{
                users: getUsersInRoom(user.room)

            })

            io.emit('roomList', {
                rooms: getAllActiveRooms()
            })
        }

        console.log(`L'utilisateur ${socket.id} s'est déconnecté `)

    })

    // Attente d'un message
    socket.on('message', ({name, text }) =>{

        const room = getUser(socket.id)?.room
        if (room){
            io.to(room).emit('message', buildMsg(name,text))
        }
                
    })

    
    // Status quand un utlisateur est entrain d'envoyer un message
    socket.on('activity', (name) => {
        const room = getUser(socket.id)?.room
        if (room) {
            socket.broadcast.to(room).emit('activity',name)

        }
        
    })
})

function buildMsg(name, text) {
    return { 
        name,
        text,
        time: new Intl.DateTimeFormat('default',{
            hour:'numeric',
            minute: 'numeric',
            second:'numeric'
        }).format(new Date())
    }
}


function activateUser(id, name, room){
    const user = {id, name, room}
    UsersState.setUsers([
        ...UsersState.users.filter(user => user.id !== id),
        user
    ])
    return user
}

function usersLeavesApp(id){
    UsersState.setUsers(
        UsersState.users.filter(user => user.id !== id)
    )
}

function getUser(id) {
    return UsersState.users.find(user => user.id === id)
}

function getUsersInRoom(room){
    return UsersState.users.filter(user => user.room == room)
}

function getAllActiveRooms(){
    return Array.from(new Set(UsersState.users.map(user => user.room)))
}
