const { db, utils } = require('../../../services')
const { SOCKETS_CHAT } = require('../../../sockets/models')
const Protection = require('./Protection')

const formatChatText = text => {
  return text
    .trim()
    .replace(/<br\s*\/*>/gi, '\n')
    .replace(/(<(p|div))/gi, '\n$1')
    .replace(/(<([^>]+)>)/gi, '')
    .replace(/\n\s*\n/g, '\n\n')
}

const Messages = {
  async addMessage({ fromUserId, toUserId, roomId, text }, returnMeta = true) {
    if (typeof fromUserId === 'number' && typeof toUserId === 'number') {
      const isAllowed = await Protection.isMessageAllowed(fromUserId, toUserId)
      if (!isAllowed) return false
    }

    text = formatChatText(text)
    const query = `INSERT INTO chat_messages(user_id, room_id, text) VALUES(${fromUserId}, (SELECT id FROM chat_rooms where user_ids @> ARRAY[$1::int[]] AND id=$2), $3) RETURNING id, (SELECT user_ids FROM chat_rooms WHERE user_ids @> ARRAY[$1::int[]] AND id=$2)`
    const values = [[fromUserId], roomId, text]

    try {
      const data = await db.query(query, values)
      if (data.rows[0]) {
        return returnMeta === true && data.rows[0]
          ? { message_id: data.rows[0].id, user_ids: data.rows[0].user_ids }
          : true
      } else {
        throw 'init room'
      }
    } catch (error) {
      const r = await initRoomWithMessage({ fromUserId, toUserId, text })
      if (r) {
        return { ...r, inited: true }
      } else return null
    }
  }
}

const initRoomWithMessage = async (
  { fromUserId, toUserId, text },
  returnMeta = true
) => {
  fromUserId = parseInt(fromUserId)
  toUserId = parseInt(toUserId)
  if (typeof fromUserId !== 'number' || typeof toUserId !== 'number')
    return false

  const chatAllowed = await Protection.isMessageAllowed(fromUserId, toUserId)
  if (!chatAllowed) return false

  const uids = fromUserId + ',' + toUserId

  console.log('uids', uids)
  let query = `SELECT id, admin_role_id, plan_id FROM users WHERE id IN (${uids});`
  try {
    text = formatChatText(text)
    query = `INSERT INTO chat_rooms(user_ids)VALUES (ARRAY[${uids}]) RETURNING user_ids;
                  INSERT INTO chat_messages(user_id, room_id, text) VALUES(${fromUserId}, (SELECT id FROM chat_rooms where user_ids @> ARRAY[${uids}]), '${text}') RETURNING id`

    const data = await db.query(query)

    return returnMeta === true && data[1].rows[0] && data[0].rows[0]
      ? { message_id: data[1].rows[0].id, user_ids: data[0].rows[0].user_ids }
      : true
  } catch (error) {
    return null
  }
}

module.exports = Messages
