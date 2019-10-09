const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    password: 'password',
    host: '192.168.1.12',
    database: 'buses',
    port: 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params)
};
