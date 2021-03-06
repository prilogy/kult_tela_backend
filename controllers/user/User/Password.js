const { utils, db, token, phoneNumber, sms } = require('../../../services/')
const { User } = require('../../../utils/')
const bcrypt = require('bcrypt')

const SALT_ROUNDS = 10

const Password = {
  async request(req, res) {
    let { phone_number } = req.body

    if (!phone_number) return utils.response.error(res)

    phone_number = phoneNumber.format(phone_number)

    const query = `INSERT INTO hashes(user_id, type, hash, code) SELECT id, 'PASSWORD_RESET', $1, $3 FROM users WHERE phone_number=$2 RETURNING id`

    const hash = token.generateToken({
      id: Math.floor(Math.random() * Math.floor(15648)),
      email: phone_number
    }).substr(50)

    const code = utils.generateSmsCode()
    const values = [hash, phone_number, code]

    try {
      const { rows } = await db.query(query, values)
      if (rows && rows.length > 0 && typeof rows[0].id === 'number') {
        const r = await sms.send('Код для сброса пароля: \n' + code, phone_number)
        //await User.Email.passwordReset(email, hash)
        return utils.response.success(res, { hash })
      }
      return  utils.response.error(res,"Неправильный телефонный номер")
    } catch (e) {
      return  utils.response.error(res, "Непредвиденная ошибка, попробуйте снова")
    }
  },
  async verifyHash(req, res) {
    const hash = req.body.hash

    if (!hash) return utils.response.error(res)

    const query = `SELECT id FROM hashes WHERE hash=$1 AND used=false`
    const values = [hash]

    try {
      const { rows } = await db.query(query, values)
      if (rows && rows.length > 0) return utils.response.success(res)
      else return utils.response.error(res, 'Ссылка недействительна')
    } catch (e) {
      return utils.response.error(res, 'Ссылка недействительна')
    }
  },
  async reset(req, res) {
    const { new_password, hash } = req.body

    if (!new_password && !hash) return utils.response.error(res)

    const passwordHashed = await bcrypt.hash(new_password, SALT_ROUNDS)

    let query = `UPDATE users SET password=$1 WHERE id=(SELECT user_id FROM hashes WHERE hash=$2 AND used=false) RETURNING id`
    let values = [passwordHashed, hash]

    try {
      const { rows } = await db.query(query, values)
      if (rows && rows.length > 0 && typeof rows[0].id === 'number') {
        const user_id = rows[0].id
        await User.Notification.add(user_id, {
          title: 'Ваш пароль был успешно изменен'
        })
        query = `UPDATE hashes SET used=true WHERE hash=$1`
        values = [hash]
        await db.query(query, values)
        return utils.response.success(res)
      } else return utils.response.error(res)
    } catch (e) {
      return utils.response.error(res)
    }
  }
}

module.exports = Password
