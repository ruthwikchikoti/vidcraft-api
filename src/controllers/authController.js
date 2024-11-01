const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { userDb } = require('../config/database');
require('dotenv').config();

exports.signup = async (req, res) => {
    const { username, password } = req.body;
    console.log(username)
    try {
        if (!password) {
            return res.status(400).json({ message: 'Password is required' });
        }

        // Check if user already exists
        userDb.get('SELECT id FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Error querying database');
            }

            if (row) {
                return res.status(400).json({
                    message: 'User already exists, please login or try with a different username',
                });
            }

            // If user doesn't exist and password is valid, proceed with signup
            const hashedPassword = await bcrypt.hash(password, 10);
            console.log(username)
            userDb.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function (err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).send('Error saving to database');
                }

                const userId = this.lastID;

                res.status(200).json({
                    message: 'User created successfully. Please login to get access token using the following userId',
                    userId,
                });
            });
        });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).send('Error in signup process');
    }
};

exports.login = async (req, res) => {
    const { username, password } = req.body;

    try {
        userDb.get('SELECT * FROM users WHERE username = ?', [username], async (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Error querying database'); 
            }

            if (!row) {
                return res.status(400).send('User not found');
            }

            if (await bcrypt.compare(password, row.password)) {
                const accessToken = jwt.sign({ userId: row.id, username: row.username }, process.env.JWT_SECRET_KEY, { expiresIn: '1h' });

                userDb.run('UPDATE users SET accessToken = ? WHERE id = ?', [accessToken, row.id], (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        if (err.message.includes('no such column: accessToken')) {
                            // If accessToken column doesn't exist, add it
                            userDb.run('ALTER TABLE users ADD COLUMN accessToken TEXT', (alterErr) => {


                                if (alterErr) {
                                    console.error('Error adding accessToken column:', alterErr);
                                    return res.status(500).send('Error updating database structure');
                                }

                                // Try updating again after adding the column
                                userDb.run('UPDATE users SET accessToken = ? WHERE id = ?', [accessToken, row.id], (updateErr) => {
                                    if (updateErr) {
                                        console.error('Error updating accessToken:', updateErr);
                                        return res.status(500).send('Error updating access token');
                                    }
                                    res.status(200).json({ accessToken });
                                });

                            });
                        } else {
                            return res.status(500).send('Error updating database');
                        }


                    } else {
                        res.status(200).json({ accessToken });
                    }
                });

            } else {
                return res.status(400).send('Invalid password');
            }
            
        });
    } catch (error) {
        console.error('Error in login:', error);
        res.status(500).send('Error in login process');
    }
};
