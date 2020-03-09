const { requireAuth } = require('../../middleware/')
const { db } = require('../../../services/')
const { User } = require('../../../utils/')

const { SOCKETS_CHAT } = require('../../models/')

const Message = (io, socket) => {
  return {
    async message(data) {
      console.log('[chat_message]')
      console.log(data)
      const to_user_id = data.to_user_id

      if (to_user_id) {
        let message = {
          fromUserId: socket.currentUser.id,
          toUserId: to_user_id,
          text: data.text,
          roomId: data.room_id
        }
        try {
          let info = await User.Chat.Message.addMessage(message)
          console.log(info)
          if (info && typeof info.message_id === 'number') {
            let query = `SELECT * FROM chat_messages_formatted WHERE id=$1`
            let values = [info.message_id]

            const { rows } = await db.query(query, values)
            let dbMessage = rows[0]

            if (dbMessage) {
              const event = info.inited ? 'chat_message_init' : 'chat_message'

              if (info.inited) {
                let dbMessageTo = JSON.parse(JSON.stringify(dbMessage))
                dbMessageTo.user_id = to_user_id

                info.user_ids.forEach(id => {
                  const sock = SOCKETS_CHAT.getUser({
                    id: id
                  })
                  if (sock)
                    io.emitArray(
                      sock.sockets,
                      event,
                      id === message.fromUserId ? dbMessageTo : dbMessage
                    )
                })
              } else {
                info.user_ids.forEach(id => {
                  const sock = SOCKETS_CHAT.getUser({
                    id: id
                  })
                  if (sock) io.emitArray(sock.sockets, event, dbMessage)
                })
              }
            }
          }
        } catch (error) {}
      }
    }
  }
}

module.exports = Message
