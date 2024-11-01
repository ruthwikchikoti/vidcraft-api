const jwt = require('jsonwebtoken');
const { userDb } = require('../config/database');

const authenticateToken = (req, res, next) => {
    const { username, userId } = req.body;

    if (!username && !userId) {
        return res.status(400).send('Username or userId is required');
    }

    const query = username ? 'SELECT * FROM users WHERE username = ?' : 'SELECT * FROM users WHERE id = ?';
    const param = username || userId;

    userDb.get(query, [param], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error querying database');
        }

        if (!row) {
            return res.status(404).send('User not found');
        }

        const token = row.accessToken;

        if (!token) {
            return res.status(401).send('No token found for user, please login again');
        }

        jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
            if (err) {
                return res.status(403).send('Invalid or expired token');
            }

            req.user = decoded;
            next();
        });
    });
};

module.exports = authenticateToken;