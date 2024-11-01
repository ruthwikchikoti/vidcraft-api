const {Seqlielize} = require('sequelize');

const db = new Seqlielize({
    dialect: 'sqlite',
    storage: './database.sqlite'
})

const userDb = new Seqlielize({
    dialect: 'sqlite',
    storage: './user.sqlite'
})

module.exports = {db,userDb}