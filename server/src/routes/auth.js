const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();

router.post('/register', async (req, res) => {
    try {
        const { username,email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: 'Email already in use' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        const newUser = new User({
            username,
            email,
            password: hashedPassword,
        });

        await newUser.save();

        return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        if(error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            return res.status(409).json({ message: `${field.charAt(0).toUpperCase() + field.slice(1)} already in use` });
        }
        console.error('Error during registration:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const accessToken = jwt.sign({ userId: user._id,username: user.username },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign({ userId: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        return res.status(200).json({ accessToken });
    } catch (error) {
        console.error('Error during login:', error);
        return res.status(500).json({ message: 'Server error' });
    }
});



module.exports = router;