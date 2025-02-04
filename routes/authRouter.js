const express = require('express');
const User = require('../models/User');
const mongoose = require("mongoose");
const router = express.Router();

mongoose.connect('mongodb+srv://skalap2endra:kGOM7z5V54vBFdp1@cluster0.vannl.mongodb.net/lab1_9?retryWrites=true&w=majority&appName=Cluster0')
    .then(() => console.log('Auth: Connected to MongoDB Atlas'))
    .catch((err) => console.error('Error connecting to MongoDB Atlas:', err));

const authMiddleware = (req, res, next) => {
    if (!req.session.userId) {
        return res.render('templates/error', {errorMessage: 'Unauthorized: Please log in'});
    }
    next();
};

// REGISTER part
router.get('/register', (req, res) => res.render('auth/registration'));

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    try {
        const existingUser = await User.findOne({username: username});
        if (existingUser !== null) {
            return res.render('templates/error', {errorMessage: 'User already exists'});
        }

        const userId = await getNextFreeUserId();
        if (isNaN(userId)) {
            return res.render('templates/error', {errorMessage: 'Failed to generate a valid user_id'});
        }

        const newUser = new User({
            user_id: userId,
            username: username,
            email: email,
            password: password,
            created_at: new Date(),
            updated_at: new Date(),
        });

        await newUser.save();
        res.redirect('/login');
    } catch (err) {
        return res.render('templates/error', {errorMessage:'Error registering user: ' + err.message});
    }
});

// LOGIN part
router.get('/login', (req, res) => res.render('auth/login'));

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({email: email});

        if (user === null || !(await bcrypt.compare(password, user.password))) {
            return res.render('templates/error', {errorMessage: 'Invalid email or password'});
        }

        req.session.userId = user.user_id;
        req.session.username = user.username;
        req.session.isLoggedIn = true;
        res.redirect('/');
    } catch (err) {
        return res.render('templates/error', {errorMessage:'Error during login: ' + err.message});
    }
});

// UPDATE part
router.get('/update', authMiddleware, async (req, res) => {
    const user = await getUser(req.session.userId);
    if (user === null) {
        return res.render('templates/error', {errorMessage: 'User not found'});
    }
    res.render('profile/update', {user});
})

router.post('/update', authMiddleware, async (req, res) => {
    const { user_id, username, email } = req.body;

    try {
        const updateData = {
            username: username,
            email: email
        };


        const updatedUser = await User.findOneAndUpdate(
            {user_id: user_id},
            {$set: updateData}
        );
        if (updatedUser === null) {
            return res.render('templates/error', {errorMessage: 'Error updating user'});
        }
        req.session.username = username;
        res.redirect('/profile');
    } catch (err) {
        return res.render('templates/error', {errorMessage: 'Error updating user'});
    }
});

// USER part
router.get('/profile', authMiddleware, async (req, res) => {
    const user = await getUser(req.session.userId);
    if (user === null) {
        return res.render('templates/error', {errorMessage: 'User not found'});
    }
    return res.render('profile/profile', {user});
})

// LOG OUT part
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.render('templates/error', {errorMessage: 'Error logging out'});
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
    });
});

router.get('/delete-account', authMiddleware, async (req, res) => {
    const userId = req.session.userId;

    try {
        const deletedUser = await User.findOneAndDelete({ user_id: userId });
        if (deletedUser === null) {
            return res.render('templates/error', {errorMessage: 'User not found or not deleted'});
        }

        req.session.destroy();
        res.redirect('/');
    } catch (err) {
        return res.render('templates/error', {errorMessage: err});
    }
});

// Helpers
async function getUser(id){
    const user = await User.findOne({ user_id: id });
    if (user === null) return null;
    return user;
}

async function getNextFreeUserId() {
    try {
        const lastUser = await User.findOne().sort({ user_id: -1 });
        if (lastUser === null) {
            return 0;
        }
        return parseInt(lastUser.user_id + 1);
    } catch (err) {
        console.error('Error retrieving next free user_id:', err.message);
        throw new Error('Failed to retrieve next free user ID');
    }
}

module.exports = router;
