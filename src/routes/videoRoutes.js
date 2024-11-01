const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');
const upload = require('../middleware/upload');
const authenticateToken = require('../middleware/auth');

//testing purposes
router.post('/hi',(req,res)=>{
    res.send("Hello");
})

router.post('/upload',upload.single('video'), videoController.uploadVideo);
router.post('/trim', authenticateToken,videoController.trimVideo);
router.post('/concatenate', authenticateToken,videoController.concatenateVideos);
router.get('/video/:token', videoController.serveVideo);

module.exports = router;