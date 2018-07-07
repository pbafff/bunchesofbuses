const { Pool } = require('pg');

const pool = new Pool({
    user: 'power_user',
    host: 'ec2-13-59-152-248.us-east-2.compute.amazonaws.com',
    database: 'trips',
    password: 'poweruserpassword',
    port: 5432,
});

module.exports = {
    query: (text, params) => pool.query(text, params)
}
